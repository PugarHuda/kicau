// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title Kicau — bird NFTs that fund conservation and power a flappy game.
/// @notice Each purchase is split in the same tx between treasury and a conservation wallet.
///         The contract never holds a balance between calls, except contest pools (enter → finalize/cancel)
///         and `owed` payouts whose push failed. v6 adds on-chain gantangan contests.
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
    uint256 public constant MAX_TITLE_BYTES = 64;
    uint256 public constant MAX_ATTESTATIONS = 32;
    /// @notice Physical floor for the flappy game: pipes spawn every 1.4 s at start and speed up
    ///         +5% per 10 points, so each point needs >= ~0.9 s of real play. 1000 ms/point is the bound.
    uint256 public constant MIN_MS_PER_POINT = 1000;
    /// @notice Slack for second-granularity block timestamps and inclusion delay.
    uint256 public constant GRACE_MS = 3000;
    uint256 public constant MAX_RUN_AGE = 1 hours;
    uint8 public constant RUN_GAME_VERSION = 3;

    struct Organizer {
        string name;
        bool active;
    }

    struct Attestation {
        address organizer;
        uint64 timestamp;
        bool revoked;
        string title;
    }

    struct Run {
        address player;
        uint64 startTime;
        uint64 startBlock;
        bool active;
        uint256 tokenId;
        uint256 seed;
    }

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
    /// @notice Total donated per species through support() (100% goes to conservation).
    mapping(uint256 speciesId => uint256) public supportOf;
    /// @notice Fan support received by a registered bird (keeper share + conservation share).
    mapping(uint256 tokenId => uint256) public birdSupportOf;
    mapping(uint256 tokenId => uint256) public birdSupporters;
    string public baseURI;

    mapping(address org => Organizer) public organizers;
    mapping(uint256 tokenId => Attestation[]) public attestations;
    /// @notice Run ids start at 1; 0 means "no run".
    mapping(uint256 runId => Run) public runs;
    mapping(address player => uint256) public activeRunOf;
    uint256 public runNonce;
    /// @notice Best score per player that came from a seeded, time-validated run.
    mapping(address player => uint256) public bestValidatedByPlayer;

    // ----------------------------------------------------------- contests (v6)

    enum ContestStatus {
        Open,
        Judging,
        Finalized,
        Cancelled
    }

    struct Contest {
        string name;
        string class_;
        address host;
        uint64 entryDeadline;
        ContestStatus status;
        uint128 entryFee;
        uint128 pool;
        uint256 entryCount;
        address[] judges;
    }

    struct JudgeScore {
        uint8 melody;
        uint8 volume;
        uint8 duration;
        uint8 style;
        bool scored;
    }

    uint256 public constant MAX_JUDGES = 5;
    uint256 public constant MAX_ENTRIES = 32;
    uint256 public constant MAX_CONTEST_NAME_BYTES = 64;
    uint256 public constant MAX_CLASS_BYTES = 32;
    uint8 public constant MAX_ASPECT = 10;
    /// @notice "No entry" marker for ContestFinalized places when a contest has < 3 entries.
    uint256 public constant NO_ENTRY = type(uint256).max;
    /// @dev Gas cap per payout/refund so a hostile receiver cannot grief a whole finalize/cancel.
    uint256 internal constant PAYOUT_GAS = 50_000;

    Contest[] internal _contests;
    mapping(uint256 contestId => mapping(address => bool)) public isJudge;
    mapping(uint256 contestId => uint256[]) internal _entries;
    mapping(uint256 contestId => mapping(uint256 tokenId => address)) public entrantOf;
    mapping(uint256 contestId => mapping(uint256 tokenId => uint256)) public entryTotal;
    mapping(uint256 contestId => mapping(uint256 tokenId => mapping(address judge => JudgeScore))) internal _scores;
    /// @notice Payouts/refunds whose push failed; claim with withdrawOwed().
    mapping(address => uint256) public owed;

    // ------------------------------------------------- living profile + Kicau Value (v6)

    /// @notice Last register/update time; drives the freshness decay of valueOf.
    mapping(uint256 tokenId => uint256) public lastUpdated;
    mapping(uint256 tokenId => uint256) public profileVersion;
    /// @notice Block of the latest BirdUpdated log (0 = never updated: read BirdRegistered at registeredAt).
    mapping(uint256 tokenId => uint256) public updatedAtBlock;
    /// @notice Contest podium finishes: wins[tokenId][0] = 1st places, [1] = 2nd, [2] = 3rd.
    mapping(uint256 tokenId => uint256[3]) internal _wins;
    mapping(uint256 tokenId => uint256) public activeAttestations;
    mapping(uint256 tokenId => uint256) public bestValidatedByToken;

    uint256 public constant VALUE_UNIT = 0.0001 ether; // price per point
    uint256 public constant FRESH_DAYS = 7;

    struct ValueBreakdown {
        uint256 base;
        uint256 wins; // 250 / 150 / 100 per 1st / 2nd / 3rd
        uint256 attestations; // 80 each, non-revoked
        uint256 supporters; // 10 each
        uint256 support; // milli-MON supported / 10, capped 500
        uint256 runs; // best validated run * 2, capped 500
        uint256 freshnessPct; // 100 when updated within 7 days, -5/day after, floor 30
        uint256 points;
        uint256 priceWei;
    }

    event BirdBought(address indexed buyer, uint256 indexed tokenId, uint256 indexed speciesId, uint256 conservation);
    event ScoreSubmitted(
        address indexed player, uint256 indexed tokenId, uint256 indexed speciesId, uint256 score, uint8 gameVersion
    );
    event Supported(address indexed supporter, uint256 indexed speciesId, uint256 amount);
    event BirdSupported(
        address indexed supporter, uint256 indexed tokenId, address indexed keeper, uint256 amount, uint256 conservation
    );
    event BirdRegistered(address indexed owner, uint256 indexed tokenId, string name, bytes image);
    event BirdUpdated(address indexed owner, uint256 indexed tokenId, uint256 version, bytes image);
    event SpeciesAdded(uint256 indexed speciesId, string name, uint256 price, uint256 maxSupply);
    event OrganizerSet(address indexed organizer, string name, bool active);
    event Attested(uint256 indexed tokenId, address indexed organizer, string title);
    event AttestationRevoked(uint256 indexed tokenId, address indexed organizer, uint256 index);
    event RunStarted(uint256 indexed runId, address indexed player, uint256 indexed tokenId, uint256 seed);
    event RunSubmitted(uint256 indexed runId, uint256 score);
    event ContestCreated(uint256 indexed contestId, address indexed host, string name, string class_, uint256 entryFee);
    event ContestEntered(uint256 indexed contestId, uint256 indexed tokenId, address indexed entrant, uint256 fee);
    event JudgingStarted(uint256 indexed contestId);
    event Scored(uint256 indexed contestId, uint256 indexed tokenId, address indexed judge, uint256 total);
    event ContestFinalized(uint256 indexed contestId, uint256 first, uint256 second, uint256 third, uint256 pool);
    event ContestCancelled(uint256 indexed contestId);
    event PayoutOwed(address indexed to, uint256 amount);

    error UnknownSpecies();
    error WrongPayment();
    error SoldOut();
    error NotBirdOwner();
    error InvalidBps();
    error ZeroAddress();
    error TransferFailed();
    error InvalidBird();
    error NotOrganizer();
    error NotCustomBird();
    error InvalidTitle();
    error TooManyAttestations();
    error InvalidAttestation();
    error RunNotActive();
    error NotRunPlayer();
    error RunExpired();
    error ScoreTooFast();
    error BelowMinSupport();
    error InvalidContest();
    error NotHost();
    error NotJudge();
    error BadStatus();
    error EntryClosed();
    error ContestFull();
    error AlreadyEntered();
    error NotEntered();
    error NotEnoughEntries();
    error InvalidScore();

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

    // ------------------------------------------------------------ support

    /// @notice Donate for a species without adopting. The full amount goes to the conservation wallet.
    /// @notice Sponsor a registered real bird: the keeper (current NFT holder) gets the treasury share,
    ///         conservation gets `conservationBps`, in the same tx. Patronage, not a sale of the animal.
    function supportBird(uint256 tokenId) external payable nonReentrant {
        if (speciesOf[tokenId] != CUSTOM_SPECIES) revert NotCustomBird();
        if (msg.value == 0) revert WrongPayment();
        // minimum sponsorship = 10% of the bird's current Kicau Value
        if (msg.value < valueBreakdown(tokenId).priceWei / 10) revert BelowMinSupport();
        address keeper = ownerOf(tokenId);
        uint256 conservation = msg.value * conservationBps / MAX_BPS;
        totalConservation += conservation;
        birdSupportOf[tokenId] += msg.value;
        birdSupporters[tokenId]++;
        _send(conservationWallet, conservation);
        _send(keeper, msg.value - conservation);
        emit BirdSupported(msg.sender, tokenId, keeper, msg.value, conservation);
    }

    function support(uint256 speciesId) external payable nonReentrant {
        if (speciesId >= _species.length) revert UnknownSpecies();
        if (msg.value == 0) revert WrongPayment();
        supportOf[speciesId] += msg.value;
        totalConservation += msg.value;
        _send(conservationWallet, msg.value);
        emit Supported(msg.sender, speciesId, msg.value);
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
        lastUpdated[tokenId] = block.timestamp;
        _safeMint(msg.sender, tokenId);

        uint256 conservation = _split(msg.value);
        emit BirdRegistered(msg.sender, tokenId, name, image);
        emit BirdBought(msg.sender, tokenId, CUSTOM_SPECIES, conservation);
    }

    /// @notice Keeper publishes a new version of the bird's sprite/profile bytes (same "KC" encoding).
    ///         Keeps the bird "fresh" for valueOf. Frontends read the BirdUpdated log at updatedAtBlock.
    function updateBird(uint256 tokenId, bytes calldata image) external {
        if (speciesOf[tokenId] != CUSTOM_SPECIES) revert NotCustomBird();
        if (ownerOf(tokenId) != msg.sender) revert NotBirdOwner();
        if (image.length == 0 || image.length > MAX_IMAGE_BYTES) revert InvalidBird();
        lastUpdated[tokenId] = block.timestamp;
        updatedAtBlock[tokenId] = block.number;
        uint256 version = ++profileVersion[tokenId];
        emit BirdUpdated(msg.sender, tokenId, version, image);
    }

    // -------------------------------------------------------------- score

    /// @notice Legacy, unvalidated score (kept for backward compatibility). v4 frontends use startRun/submitRun.
    function submitScore(uint256 tokenId, uint256 score, uint8 gameVersion) external {
        if (ownerOf(tokenId) != msg.sender) revert NotBirdOwner();
        _recordScore(tokenId, score, gameVersion);
    }

    // --------------------------------------------------------------- runs

    /// @notice Start a seeded run. The seed drives the frontend's deterministic pipe layout.
    ///         Starting a new run closes the caller's previous one.
    function startRun(uint256 tokenId) external returns (uint256 runId, uint256 seed) {
        if (ownerOf(tokenId) != msg.sender) revert NotBirdOwner();
        uint256 prev = activeRunOf[msg.sender];
        if (prev != 0) runs[prev].active = false;

        runId = ++runNonce;
        seed = uint256(keccak256(abi.encode(block.prevrandao, msg.sender, tokenId, runId)));
        runs[runId] = Run(msg.sender, uint64(block.timestamp), uint64(block.number), true, tokenId, seed);
        activeRunOf[msg.sender] = runId;
        emit RunStarted(runId, msg.sender, tokenId, seed);
    }

    /// @notice Submit a run's score. Rejected if faster than MIN_MS_PER_POINT allows or older than MAX_RUN_AGE.
    function submitRun(uint256 runId, uint256 score) external {
        Run storage r = runs[runId];
        if (!r.active) revert RunNotActive();
        if (r.player != msg.sender) revert NotRunPlayer();
        uint256 tokenId = r.tokenId;
        if (ownerOf(tokenId) != msg.sender) revert NotBirdOwner();
        uint256 elapsed = block.timestamp - r.startTime;
        if (elapsed > MAX_RUN_AGE) revert RunExpired();
        // Division form so a huge score cannot overflow.
        if (score > (elapsed * 1000 + GRACE_MS) / MIN_MS_PER_POINT) revert ScoreTooFast();

        r.active = false;
        activeRunOf[msg.sender] = 0;
        if (score > bestValidatedByPlayer[msg.sender]) bestValidatedByPlayer[msg.sender] = score;
        if (score > bestValidatedByToken[tokenId]) bestValidatedByToken[tokenId] = score;
        _recordScore(tokenId, score, RUN_GAME_VERSION);
        emit RunSubmitted(runId, score);
    }

    // ------------------------------------------------------- attestations

    /// @notice Active organizers attest a title (e.g. a contest championship) to a registered bird.
    function attest(uint256 tokenId, string calldata title) external {
        if (!organizers[msg.sender].active) revert NotOrganizer();
        if (speciesOf[tokenId] != CUSTOM_SPECIES) revert NotCustomBird();
        uint256 len = bytes(title).length;
        if (len == 0 || len > MAX_TITLE_BYTES) revert InvalidTitle();
        Attestation[] storage list = attestations[tokenId];
        if (list.length >= MAX_ATTESTATIONS) revert TooManyAttestations();
        list.push(Attestation(msg.sender, uint64(block.timestamp), false, title));
        activeAttestations[tokenId]++;
        emit Attested(tokenId, msg.sender, title);
    }

    /// @notice The attesting organizer can revoke their own attestation (kept, marked revoked).
    function revokeAttestation(uint256 tokenId, uint256 index) external {
        Attestation[] storage list = attestations[tokenId];
        if (index >= list.length) revert InvalidAttestation();
        Attestation storage a = list[index];
        if (a.organizer != msg.sender || a.revoked) revert InvalidAttestation();
        a.revoked = true;
        activeAttestations[tokenId]--;
        emit AttestationRevoked(tokenId, msg.sender, index);
    }

    // ----------------------------------------------------------- contests

    /// @notice Host a gantangan contest. Permissionless: host = msg.sender.
    function createContest(
        string calldata name,
        string calldata class_,
        uint256 entryFee,
        address[] calldata judges,
        uint64 entryDeadline
    ) external returns (uint256 contestId) {
        uint256 nl = bytes(name).length;
        uint256 cl = bytes(class_).length;
        uint256 jn = judges.length;
        if (
            nl == 0 || nl > MAX_CONTEST_NAME_BYTES || cl == 0 || cl > MAX_CLASS_BYTES || jn == 0 || jn > MAX_JUDGES
                || entryDeadline <= block.timestamp || entryFee > type(uint128).max
        ) revert InvalidContest();

        contestId = _contests.length;
        Contest storage c = _contests.push();
        c.name = name;
        c.class_ = class_;
        c.host = msg.sender;
        c.entryDeadline = entryDeadline;
        c.entryFee = uint128(entryFee);
        for (uint256 i; i < jn; i++) {
            address j = judges[i];
            if (j == address(0) || isJudge[contestId][j]) revert InvalidContest();
            isJudge[contestId][j] = true;
            c.judges.push(j);
        }
        emit ContestCreated(contestId, msg.sender, name, class_, entryFee);
    }

    /// @notice Enter one of your registered birds, paying exactly the entry fee into the pool.
    function enter(uint256 contestId, uint256 tokenId) external payable nonReentrant {
        Contest storage c = _contest(contestId);
        if (c.status != ContestStatus.Open) revert BadStatus();
        if (block.timestamp >= c.entryDeadline) revert EntryClosed();
        if (msg.value != c.entryFee) revert WrongPayment();
        if (speciesOf[tokenId] != CUSTOM_SPECIES) revert NotCustomBird();
        if (ownerOf(tokenId) != msg.sender) revert NotBirdOwner();
        if (entrantOf[contestId][tokenId] != address(0)) revert AlreadyEntered();
        if (c.entryCount >= MAX_ENTRIES) revert ContestFull();

        entrantOf[contestId][tokenId] = msg.sender;
        _entries[contestId].push(tokenId);
        c.entryCount++;
        c.pool += uint128(msg.value);
        emit ContestEntered(contestId, tokenId, msg.sender, msg.value);
    }

    function startJudging(uint256 contestId) external {
        Contest storage c = _hostOf(contestId);
        if (c.status != ContestStatus.Open) revert BadStatus();
        if (c.entryCount < 2) revert NotEnoughEntries();
        c.status = ContestStatus.Judging;
        emit JudgingStarted(contestId);
    }

    /// @notice A judge scores one entry on four aspects (0..10). Re-scoring overwrites until finalized.
    function score(uint256 contestId, uint256 tokenId, uint8 melody, uint8 volume, uint8 duration, uint8 style)
        external
    {
        Contest storage c = _contest(contestId);
        if (!isJudge[contestId][msg.sender]) revert NotJudge();
        if (c.status != ContestStatus.Judging) revert BadStatus();
        if (entrantOf[contestId][tokenId] == address(0)) revert NotEntered();
        if (melody > MAX_ASPECT || volume > MAX_ASPECT || duration > MAX_ASPECT || style > MAX_ASPECT) {
            revert InvalidScore();
        }
        JudgeScore storage js = _scores[contestId][tokenId][msg.sender];
        uint256 total = entryTotal[contestId][tokenId];
        if (js.scored) total -= uint256(js.melody) + js.volume + js.duration + js.style;
        total += uint256(melody) + volume + duration + style;
        entryTotal[contestId][tokenId] = total;
        _scores[contestId][tokenId][msg.sender] = JudgeScore(melody, volume, duration, style, true);
        emit Scored(contestId, tokenId, msg.sender, total);
    }

    /// @notice Rank by total (ties: earlier entry wins) and pay 50/25/15 to the current holders; 10%, rounding
    ///         dust and unfilled places go to conservation. Active-organizer hosts auto-attest the top 3.
    function finalize(uint256 contestId) external nonReentrant {
        Contest storage c = _hostOf(contestId);
        if (c.status != ContestStatus.Judging) revert BadStatus();
        c.status = ContestStatus.Finalized;

        uint256[3] memory top = [NO_ENTRY, NO_ENTRY, NO_ENTRY];
        uint256[3] memory best;
        uint256[] storage list = _entries[contestId];
        for (uint256 i; i < list.length; i++) {
            uint256 t = entryTotal[contestId][list[i]];
            // strict > keeps the earlier entry ahead on ties
            for (uint256 k; k < 3; k++) {
                if (top[k] == NO_ENTRY || t > best[k]) {
                    for (uint256 m = 2; m > k; m--) {
                        top[m] = top[m - 1];
                        best[m] = best[m - 1];
                    }
                    top[k] = list[i];
                    best[k] = t;
                    break;
                }
            }
        }

        uint256 pool = c.pool;
        c.pool = 0;
        uint256[3] memory pct = [uint256(50), 25, 15];
        uint256 paid;
        bool attests = organizers[c.host].active;
        for (uint256 k; k < 3; k++) {
            if (top[k] == NO_ENTRY) continue;
            uint256 prize = pool * pct[k] / 100;
            paid += prize;
            _wins[top[k]][k]++;
            _payOrOwe(ownerOf(top[k]), prize);
            if (attests && attestations[top[k]].length < MAX_ATTESTATIONS) {
                string memory title = string.concat("Juara ", (k + 1).toString(), unicode" · ", c.name);
                attestations[top[k]].push(Attestation(c.host, uint64(block.timestamp), false, title));
                activeAttestations[top[k]]++;
                emit Attested(top[k], c.host, title);
            }
        }
        uint256 cons = pool - paid;
        totalConservation += cons;
        _payOrOwe(conservationWallet, cons);
        emit ContestFinalized(contestId, top[0], top[1], top[2], pool);
    }

    /// @notice Host cancels while Open/Judging; every entry fee is refunded to whoever paid it.
    function cancelContest(uint256 contestId) external nonReentrant {
        Contest storage c = _hostOf(contestId);
        if (c.status != ContestStatus.Open && c.status != ContestStatus.Judging) revert BadStatus();
        c.status = ContestStatus.Cancelled;
        uint256 fee = c.entryFee;
        c.pool = 0;
        uint256[] storage list = _entries[contestId];
        for (uint256 i; i < list.length; i++) {
            _payOrOwe(entrantOf[contestId][list[i]], fee);
        }
        emit ContestCancelled(contestId);
    }

    /// @notice Claim a payout/refund whose direct push failed.
    function withdrawOwed() external nonReentrant {
        uint256 amount = owed[msg.sender];
        owed[msg.sender] = 0;
        _send(msg.sender, amount);
    }

    function winsOf(uint256 tokenId) external view returns (uint256[3] memory) {
        return _wins[tokenId];
    }

    /// @notice Reputation-driven sponsorship value of a registered bird: rises with wins, titles,
    ///         support and validated runs; decays 5%/day after 7 days without updateBird (floor 30%).
    function valueBreakdown(uint256 tokenId) public view returns (ValueBreakdown memory v) {
        if (speciesOf[tokenId] != CUSTOM_SPECIES) revert NotCustomBird();
        uint256[3] storage w = _wins[tokenId];
        v.base = 100;
        v.wins = w[0] * 250 + w[1] * 150 + w[2] * 100;
        v.attestations = activeAttestations[tokenId] * 80;
        v.supporters = birdSupporters[tokenId] * 10;
        v.support = _min(birdSupportOf[tokenId] / 1e15 / 10, 500);
        v.runs = _min(bestValidatedByToken[tokenId] * 2, 500);
        uint256 days_ = (block.timestamp - lastUpdated[tokenId]) / 1 days;
        v.freshnessPct = days_ <= FRESH_DAYS ? 100 : (days_ - FRESH_DAYS) * 5 >= 70 ? 30 : 100 - (days_ - FRESH_DAYS) * 5;
        v.points = (v.base + v.wins + v.attestations + v.supporters + v.support + v.runs) * v.freshnessPct / 100;
        v.priceWei = v.points * VALUE_UNIT;
    }

    function valueOf(uint256 tokenId) external view returns (uint256 points, uint256 priceWei) {
        ValueBreakdown memory v = valueBreakdown(tokenId);
        return (v.points, v.priceWei);
    }

    function contestCount() external view returns (uint256) {
        return _contests.length;
    }

    function getContest(uint256 contestId) external view returns (Contest memory) {
        return _contest(contestId);
    }

    function entriesOf(uint256 contestId) external view returns (uint256[] memory tokenIds, uint256[] memory totals) {
        tokenIds = _entries[contestId];
        totals = new uint256[](tokenIds.length);
        for (uint256 i; i < tokenIds.length; i++) {
            totals[i] = entryTotal[contestId][tokenIds[i]];
        }
    }

    function judgeScoreOf(uint256 contestId, uint256 tokenId, address judge) external view returns (JudgeScore memory) {
        return _scores[contestId][tokenId][judge];
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

    /// @notice Leaderboard plus each player's best score from validated runs (0 = none yet).
    /// @dev ponytail: same unbounded read as getLeaderboard; indexer when players grow.
    function getLeaderboardV2()
        external
        view
        returns (address[] memory players, uint256[] memory bestScores, uint256[] memory bestValidated)
    {
        players = _players;
        uint256 n = players.length;
        bestScores = new uint256[](n);
        bestValidated = new uint256[](n);
        for (uint256 i; i < n; i++) {
            bestScores[i] = bestByPlayer[players[i]];
            bestValidated[i] = bestValidatedByPlayer[players[i]];
        }
    }

    function attestationsOf(uint256 tokenId) external view returns (Attestation[] memory) {
        return attestations[tokenId];
    }

    function attestationCount(uint256 tokenId) external view returns (uint256) {
        return attestations[tokenId].length;
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

    function setOrganizer(address org, string calldata name, bool active) external onlyOwner {
        if (org == address(0)) revert ZeroAddress();
        uint256 len = bytes(name).length;
        if (len == 0 || len > MAX_TITLE_BYTES) revert InvalidTitle();
        organizers[org] = Organizer(name, active);
        emit OrganizerSet(org, name, active);
    }

    // ----------------------------------------------------------- internal

    function _addSpecies(string memory name, uint128 price, uint32 maxSupply, uint16 gravity, uint16 flapPower, uint16 hitbox)
        internal
    {
        _species.push(Species(name, price, maxSupply, 0, gravity, flapPower, hitbox));
        emit SpeciesAdded(_species.length - 1, name, price, maxSupply);
    }

    function _recordScore(uint256 tokenId, uint256 score, uint8 gameVersion) internal {
        if (!_isPlayer[msg.sender]) {
            _isPlayer[msg.sender] = true;
            _players.push(msg.sender);
        }
        if (score > bestByToken[tokenId]) bestByToken[tokenId] = score;
        if (score > bestByPlayer[msg.sender]) bestByPlayer[msg.sender] = score;
        emit ScoreSubmitted(msg.sender, tokenId, speciesOf[tokenId], score, gameVersion);
    }

    /// @dev Pass-through split; rounding dust goes to treasury. Returns the conservation share.
    function _split(uint256 amount) internal returns (uint256 conservation) {
        conservation = amount * conservationBps / MAX_BPS;
        totalConservation += conservation;
        _send(conservationWallet, conservation);
        _send(treasury, amount - conservation);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function _contest(uint256 contestId) internal view returns (Contest storage) {
        if (contestId >= _contests.length) revert InvalidContest();
        return _contests[contestId];
    }

    function _hostOf(uint256 contestId) internal view returns (Contest storage c) {
        c = _contest(contestId);
        if (c.host != msg.sender) revert NotHost();
    }

    /// @dev Push with a gas cap; a reverting/gas-hungry receiver is credited to `owed` instead of blocking everyone.
    function _payOrOwe(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount, gas: PAYOUT_GAS}("");
        if (!ok) {
            owed[to] += amount;
            emit PayoutOwed(to, amount);
        }
    }

    function _send(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
