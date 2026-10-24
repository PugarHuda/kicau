// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Kicau — bird NFTs that fund conservation and power a flappy game.
/// @notice Each purchase is split in the same tx between treasury and a conservation wallet.
///         The contract never holds a balance between calls.
contract Kicau is ERC721Enumerable, Ownable, ReentrancyGuard {
    using Strings for uint256;

    struct Species {
        string name;
        uint128 price;
        uint32 maxSupply;
        uint32 minted;
        // Game stats, relative: 100 = normal.
        uint16 gravity;
        uint16 flapPower;
        uint16 hitbox;
    }

    uint16 public constant MAX_BPS = 10_000;
    /// @notice speciesOf value for user-registered birds (real bird photo → pixel character).
    uint256 public constant CUSTOM_SPECIES = 999;
    uint256 public constant MAX_NAME_BYTES = 32;
    uint256 public constant MAX_IMAGE_BYTES = 4096;

    Species[] internal _species;
    mapping(uint256 tokenId => uint256) public speciesOf;
    mapping(uint256 tokenId => uint256) public bestByToken;
    mapping(address player => uint256) public bestByPlayer;
    address[] internal _players;
    mapping(address player => bool) internal _isPlayer;

    address public treasury;
    address public conservationWallet;
    uint16 public conservationBps = 3_000;
    uint256 public totalConservation;
    uint256 public nextTokenId;
    uint256 public registerFee = 0.005 ether;
    /// @dev Custom bird images live in the BirdRegistered event (cheap log data, not storage).
    ///      Frontends fetch the log from exactly this block, so no wide getLogs range is needed.
    mapping(uint256 tokenId => uint256) public registeredAt;
    mapping(uint256 tokenId => string) public customName;
    string public baseURI;

    event BirdBought(address indexed buyer, uint256 indexed tokenId, uint256 indexed speciesId, uint256 conservation);
    event ScoreSubmitted(
        address indexed player, uint256 indexed tokenId, uint256 indexed speciesId, uint256 score, uint8 gameVersion
    );
    event BirdRegistered(address indexed owner, uint256 indexed tokenId, string name, bytes image);
    event SpeciesAdded(uint256 indexed speciesId, string name, uint256 price, uint256 maxSupply);

    error UnknownSpecies();
    error WrongPayment();
    error SoldOut();
    error NotBirdOwner();
    error InvalidBps();
    error ZeroAddress();
    error TransferFailed();
    error InvalidBird();

    constructor(address treasury_, address conservationWallet_, string memory baseURI_) ERC721("Kicau", "KICAU") Ownable(msg.sender) {
        if (treasury_ == address(0) || conservationWallet_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        conservationWallet = conservationWallet_;
        baseURI = baseURI_;

        _addSpecies("Kenari", 0.01 ether, 100, 100, 100, 80);
        _addSpecies("Lovebird", 0.02 ether, 100, 85, 90, 100);
        _addSpecies("Murai Batu", 0.05 ether, 50, 110, 125, 100);
        _addSpecies("Cucak Rawa", 0.1 ether, 20, 100, 110, 110);
        _addSpecies("Jalak Bali", 0.2 ether, 10, 90, 110, 95);
    }

    // ---------------------------------------------------------------- buy

    function buy(uint256 speciesId) external payable nonReentrant returns (uint256 tokenId) {
        if (speciesId >= _species.length) revert UnknownSpecies();
        Species storage s = _species[speciesId];
        if (msg.value != s.price) revert WrongPayment();
        if (s.minted >= s.maxSupply) revert SoldOut();

        s.minted++;
        tokenId = nextTokenId++;
        speciesOf[tokenId] = speciesId;
        _safeMint(msg.sender, tokenId);

        uint256 conservation = _split(msg.value);
        emit BirdBought(msg.sender, tokenId, speciesId, conservation);
    }

    // ----------------------------------------------------------- register

    /// @notice Register your own bird: `image` is a small pixel-art PNG made from its photo.
    function registerBird(string calldata name, bytes calldata image)
        external
        payable
        nonReentrant
        returns (uint256 tokenId)
    {
        uint256 nameLen = bytes(name).length;
        if (nameLen == 0 || nameLen > MAX_NAME_BYTES || image.length == 0 || image.length > MAX_IMAGE_BYTES) {
            revert InvalidBird();
        }
        if (msg.value != registerFee) revert WrongPayment();

        tokenId = nextTokenId++;
        speciesOf[tokenId] = CUSTOM_SPECIES;
        customName[tokenId] = name;
        registeredAt[tokenId] = block.number;
        _safeMint(msg.sender, tokenId);

        uint256 conservation = _split(msg.value);
        emit BirdRegistered(msg.sender, tokenId, name, image);
        emit BirdBought(msg.sender, tokenId, CUSTOM_SPECIES, conservation);
    }

    // -------------------------------------------------------------- score

    /// @dev Score is client-reported; anti-cheat (signed replays) is roadmap.
    function submitScore(uint256 tokenId, uint256 score, uint8 gameVersion) external {
        if (ownerOf(tokenId) != msg.sender) revert NotBirdOwner();
        if (!_isPlayer[msg.sender]) {
            _isPlayer[msg.sender] = true;
            _players.push(msg.sender);
        }
        if (score > bestByToken[tokenId]) bestByToken[tokenId] = score;
        if (score > bestByPlayer[msg.sender]) bestByPlayer[msg.sender] = score;
        emit ScoreSubmitted(msg.sender, tokenId, speciesOf[tokenId], score, gameVersion);
    }

    // -------------------------------------------------------------- views

    function speciesCount() external view returns (uint256) {
        return _species.length;
    }

    function getSpecies(uint256 speciesId) external view returns (Species memory) {
        if (speciesId >= _species.length) revert UnknownSpecies();
        return _species[speciesId];
    }

    function getAllSpecies() external view returns (Species[] memory) {
        return _species;
    }

    /// @notice All token ids owned by `owner` (for "My Birds" without an indexer).
    function tokensOf(address owner) external view returns (uint256[] memory ids) {
        uint256 n = balanceOf(owner);
        ids = new uint256[](n);
        for (uint256 i; i < n; i++) {
            ids[i] = tokenOfOwnerByIndex(owner, i);
        }
    }

    /// @notice Every player with their best score; sorting happens off-chain.
    /// @dev ponytail: unbounded array read, fine for a demo. Move to an indexer once players grow into thousands.
    function getLeaderboard() external view returns (address[] memory players, uint256[] memory scores) {
        players = _players;
        scores = new uint256[](players.length);
        for (uint256 i; i < players.length; i++) {
            scores[i] = bestByPlayer[players[i]];
        }
    }

    /// @notice Game stats for a token. Registered birds play with balanced 100/100/100.
    function statsOf(uint256 tokenId) external view returns (uint16 gravity, uint16 flapPower, uint16 hitbox) {
        _requireOwned(tokenId);
        uint256 sid = speciesOf[tokenId];
        if (sid == CUSTOM_SPECIES) return (100, 100, 100);
        Species storage s = _species[sid];
        return (s.gravity, s.flapPower, s.hitbox);
    }

    /// @notice Metadata: `<baseURI><speciesId>.json`, or `<baseURI>c<tokenId>.json` for registered birds.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        if (speciesOf[tokenId] == CUSTOM_SPECIES) return string.concat(baseURI, "c", tokenId.toString(), ".json");
        return string.concat(baseURI, speciesOf[tokenId].toString(), ".json");
    }

    // -------------------------------------------------------------- admin

    function addSpecies(string calldata name, uint128 price, uint32 maxSupply, uint16 gravity, uint16 flapPower, uint16 hitbox)
        external
        onlyOwner
    {
        _addSpecies(name, price, maxSupply, gravity, flapPower, hitbox);
    }

    function setConservationWallet(address wallet) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        conservationWallet = wallet;
    }

    function setTreasury(address wallet) external onlyOwner {
        if (wallet == address(0)) revert ZeroAddress();
        treasury = wallet;
    }

    function setConservationBps(uint16 bps) external onlyOwner {
        if (bps > MAX_BPS) revert InvalidBps();
        conservationBps = bps;
    }

    function setRegisterFee(uint256 fee) external onlyOwner {
        registerFee = fee;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI = uri;
    }

    // ----------------------------------------------------------- internal

    function _addSpecies(string memory name, uint128 price, uint32 maxSupply, uint16 gravity, uint16 flapPower, uint16 hitbox)
        internal
    {
        _species.push(Species(name, price, maxSupply, 0, gravity, flapPower, hitbox));
        emit SpeciesAdded(_species.length - 1, name, price, maxSupply);
    }

    /// @dev Pass-through split; rounding dust goes to treasury. Returns the conservation share.
    function _split(uint256 amount) internal returns (uint256 conservation) {
        conservation = amount * conservationBps / MAX_BPS;
        totalConservation += conservation;
        _send(conservationWallet, conservation);
        _send(treasury, amount - conservation);
    }

    function _send(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
