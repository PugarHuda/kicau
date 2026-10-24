// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Kicau} from "../src/Kicau.sol";

contract Rejecter {
    receive() external payable {
        revert("no");
    }
}

contract KicauTest is Test {
    Kicau kicau;
    address treasury = makeAddr("treasury");
    address conservation = makeAddr("conservation");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        kicau = new Kicau(treasury, conservation, "https://kicau.example/metadata/");
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_SeedsFiveSpecies() public view {
        assertEq(kicau.speciesCount(), 5);
        Kicau.Species memory murai = kicau.getSpecies(2);
        assertEq(murai.name, "Murai Batu");
        assertEq(murai.flapPower, 125);
    }

    function test_BuySplitsPayment() public {
        vm.prank(alice);
        uint256 id = kicau.buy{value: 0.05 ether}(2);

        assertEq(kicau.ownerOf(id), alice);
        assertEq(kicau.speciesOf(id), 2);
        assertEq(conservation.balance, 0.015 ether);
        assertEq(treasury.balance, 0.035 ether);
        assertEq(kicau.totalConservation(), 0.015 ether);
        assertEq(address(kicau).balance, 0);
        assertEq(kicau.getSpecies(2).minted, 1);
        assertEq(kicau.tokenURI(id), "https://kicau.example/metadata/2.json");
    }

    function test_RevertWrongPayment() public {
        vm.prank(alice);
        vm.expectRevert(Kicau.WrongPayment.selector);
        kicau.buy{value: 0.02 ether}(0);
    }

    function test_RevertUnknownSpecies() public {
        vm.prank(alice);
        vm.expectRevert(Kicau.UnknownSpecies.selector);
        kicau.buy{value: 0.01 ether}(99);
    }

    function test_RevertSoldOut() public {
        vm.deal(alice, 100 ether);
        vm.startPrank(alice);
        for (uint256 i; i < 10; i++) {
            kicau.buy{value: 0.2 ether}(4);
        }
        vm.expectRevert(Kicau.SoldOut.selector);
        kicau.buy{value: 0.2 ether}(4);
        vm.stopPrank();
    }

    function test_RevertWhenPayoutFails() public {
        Kicau bad = new Kicau(treasury, address(new Rejecter()), "");
        vm.prank(alice);
        vm.expectRevert(Kicau.TransferFailed.selector);
        bad.buy{value: 0.01 ether}(0);
    }

    function test_SubmitScoreKeepsBest() public {
        vm.startPrank(alice);
        uint256 id = kicau.buy{value: 0.01 ether}(0);

        vm.expectEmit(true, true, true, true);
        emit Kicau.ScoreSubmitted(alice, id, 0, 12, 1);
        kicau.submitScore(id, 12, 1);

        kicau.submitScore(id, 5, 1);
        vm.stopPrank();

        assertEq(kicau.bestByToken(id), 12);
        assertEq(kicau.bestByPlayer(alice), 12);

        (address[] memory players, uint256[] memory scores) = kicau.getLeaderboard();
        assertEq(players.length, 1);
        assertEq(players[0], alice);
        assertEq(scores[0], 12);
        assertEq(kicau.tokensOf(alice)[0], id);
    }

    function test_RevertSubmitScoreNotOwner() public {
        vm.prank(alice);
        uint256 id = kicau.buy{value: 0.01 ether}(0);

        vm.prank(bob);
        vm.expectRevert(Kicau.NotBirdOwner.selector);
        kicau.submitScore(id, 99, 1);
    }

    function test_OnlyOwnerAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        kicau.setConservationBps(100);

        vm.expectRevert(Kicau.InvalidBps.selector);
        kicau.setConservationBps(10_001);
    }

    function testFuzz_SplitConservesValue(uint16 bps) public {
        bps = uint16(bound(bps, 0, 10_000));
        kicau.setConservationBps(bps);
        vm.prank(alice);
        kicau.buy{value: 0.1 ether}(3);
        assertEq(conservation.balance + treasury.balance, 0.1 ether);
        assertEq(address(kicau).balance, 0);
    }

    function test_RegisterBird() public {
        bytes memory img = hex"89504e470d0a1a0a";
        vm.recordLogs();
        vm.prank(alice);
        uint256 id = kicau.registerBird{value: 0.005 ether}("Si Jambul", img);

        assertEq(kicau.ownerOf(id), alice);
        assertEq(kicau.speciesOf(id), kicau.CUSTOM_SPECIES());
        assertEq(kicau.customName(id), "Si Jambul");
        assertEq(kicau.registeredAt(id), block.number);
        assertEq(conservation.balance, 0.0015 ether);
        assertEq(kicau.tokenURI(id), "https://kicau.example/metadata/c0.json");
        (uint16 g, uint16 f, uint16 h) = kicau.statsOf(id);
        assertEq(g + f + h, 300);

        vm.prank(alice);
        kicau.submitScore(id, 3, 1);
        assertEq(kicau.bestByToken(id), 3);
    }

    function test_RevertRegisterInvalid() public {
        vm.startPrank(alice);
        vm.expectRevert(Kicau.InvalidBird.selector);
        kicau.registerBird{value: 0.005 ether}("", hex"01");
        vm.expectRevert(Kicau.InvalidBird.selector);
        kicau.registerBird{value: 0.005 ether}("x", new bytes(4097));
        vm.expectRevert(Kicau.WrongPayment.selector);
        kicau.registerBird{value: 0.001 ether}("x", hex"01");
        vm.stopPrank();
    }

    function test_StatsOfSpecies() public {
        vm.prank(alice);
        uint256 id = kicau.buy{value: 0.05 ether}(2);
        (, uint16 f,) = kicau.statsOf(id);
        assertEq(f, 125);
    }
}
