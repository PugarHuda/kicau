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

    function test_SupportGoesFullyToConservation() public {
        vm.prank(alice);
        kicau.support{value: 0.02 ether}(3);
        assertEq(conservation.balance, 0.02 ether);
        assertEq(treasury.balance, 0);
        assertEq(kicau.supportOf(3), 0.02 ether);
        assertEq(kicau.totalConservation(), 0.02 ether);
        assertEq(address(kicau).balance, 0);
    }

    function test_RevertSupportInvalid() public {
        vm.startPrank(alice);
        vm.expectRevert(Kicau.WrongPayment.selector);
        kicau.support{value: 0}(0);
        vm.expectRevert(Kicau.UnknownSpecies.selector);
        kicau.support{value: 1}(42);
        vm.stopPrank();
    }

    // ------------------------------------------------------- v4: organizers

    address org = makeAddr("org");

    function _customBird() internal returns (uint256) {
        vm.prank(alice);
        return kicau.registerBird{value: 0.005 ether}("Si Jambul", hex"4b4301");
    }

    function test_OrganizerAddRemove() public {
        kicau.setOrganizer(org, "Kontes Kicau", true);
        (string memory name, bool active) = kicau.organizers(org);
        assertEq(name, "Kontes Kicau");
        assertTrue(active);
        kicau.setOrganizer(org, "Kontes Kicau", false);
        (, active) = kicau.organizers(org);
        assertFalse(active);

        vm.prank(alice);
        vm.expectRevert();
        kicau.setOrganizer(alice, "x", true);
        vm.expectRevert(Kicau.ZeroAddress.selector);
        kicau.setOrganizer(address(0), "x", true);
    }

    function test_AttestOnlyActiveOrganizer() public {
        uint256 id = _customBird();
        vm.prank(org);
        vm.expectRevert(Kicau.NotOrganizer.selector);
        kicau.attest(id, "Champion");

        kicau.setOrganizer(org, "Kontes Kicau", true);
        vm.prank(org);
        vm.expectEmit(true, true, false, true);
        emit Kicau.Attested(id, org, "Champion");
        kicau.attest(id, "Champion");

        assertEq(kicau.attestationCount(id), 1);
        Kicau.Attestation[] memory list = kicau.attestationsOf(id);
        assertEq(list[0].organizer, org);
        assertEq(list[0].title, "Champion");
        assertEq(list[0].timestamp, block.timestamp);
        assertFalse(list[0].revoked);

        kicau.setOrganizer(org, "Kontes Kicau", false);
        vm.prank(org);
        vm.expectRevert(Kicau.NotOrganizer.selector);
        kicau.attest(id, "Again");
    }

    function test_AttestOnlyCustomBirdAndLimits() public {
        kicau.setOrganizer(org, "Kontes Kicau", true);
        vm.prank(alice);
        uint256 bought = kicau.buy{value: 0.01 ether}(0);
        uint256 id = _customBird();

        vm.startPrank(org);
        vm.expectRevert(Kicau.NotCustomBird.selector);
        kicau.attest(bought, "Champion");
        vm.expectRevert(Kicau.NotCustomBird.selector);
        kicau.attest(12345, "Champion");
        vm.expectRevert(Kicau.InvalidTitle.selector);
        kicau.attest(id, "");
        vm.expectRevert(Kicau.InvalidTitle.selector);
        kicau.attest(id, string(new bytes(65)));
        kicau.attest(id, string(new bytes(64)));
        for (uint256 i = 1; i < 32; i++) {
            kicau.attest(id, "t");
        }
        vm.expectRevert(Kicau.TooManyAttestations.selector);
        kicau.attest(id, "t");
        vm.stopPrank();
        assertEq(kicau.attestationCount(id), 32);
    }

    function test_RevokeAttestation() public {
        kicau.setOrganizer(org, "Kontes Kicau", true);
        kicau.setOrganizer(bob, "Other", true);
        uint256 id = _customBird();
        vm.prank(org);
        kicau.attest(id, "Champion");

        vm.prank(bob);
        vm.expectRevert(Kicau.InvalidAttestation.selector);
        kicau.revokeAttestation(id, 0);
        vm.prank(org);
        vm.expectRevert(Kicau.InvalidAttestation.selector);
        kicau.revokeAttestation(id, 1);

        vm.prank(org);
        kicau.revokeAttestation(id, 0);
        assertTrue(kicau.attestationsOf(id)[0].revoked);
        vm.prank(org);
        vm.expectRevert(Kicau.InvalidAttestation.selector);
        kicau.revokeAttestation(id, 0);
    }

    // ------------------------------------------------------------- v4: runs

    function _aliceRun() internal returns (uint256 tokenId, uint256 runId, uint256 seed) {
        vm.startPrank(alice);
        tokenId = kicau.buy{value: 0.01 ether}(0);
        (runId, seed) = kicau.startRun(tokenId);
        vm.stopPrank();
    }

    function test_RunHappyPath() public {
        (uint256 tokenId, uint256 runId, uint256 seed) = _aliceRun();
        assertEq(runId, 1);
        (address player, uint64 start,, bool active, uint256 tid, uint256 s) = kicau.runs(runId);
        assertEq(player, alice);
        assertEq(start, block.timestamp);
        assertTrue(active);
        assertEq(tid, tokenId);
        assertEq(s, seed);
        assertEq(kicau.activeRunOf(alice), runId);

        vm.warp(block.timestamp + 20);
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit Kicau.ScoreSubmitted(alice, tokenId, 0, 20, 3);
        kicau.submitRun(runId, 20);

        assertEq(kicau.bestByToken(tokenId), 20);
        assertEq(kicau.bestByPlayer(alice), 20);
        assertEq(kicau.bestValidatedByPlayer(alice), 20);
        assertEq(kicau.activeRunOf(alice), 0);
        (,,, active,,) = kicau.runs(runId);
        assertFalse(active);

        vm.prank(alice);
        vm.expectRevert(Kicau.RunNotActive.selector);
        kicau.submitRun(runId, 1);
    }

    function test_RevertRunTooFast() public {
        (, uint256 runId,) = _aliceRun();
        vm.warp(block.timestamp + 5);
        vm.prank(alice);
        vm.expectRevert(Kicau.ScoreTooFast.selector);
        kicau.submitRun(runId, 9); // 5 s + 3 s grace = max 8
        vm.prank(alice);
        kicau.submitRun(runId, 8);
    }

    function test_RevertRunWrongPlayer() public {
        (, uint256 runId,) = _aliceRun();
        vm.warp(block.timestamp + 10);
        vm.prank(bob);
        vm.expectRevert(Kicau.NotRunPlayer.selector);
        kicau.submitRun(runId, 1);
    }

    function test_RevertRunTokenTransferred() public {
        (uint256 tokenId, uint256 runId,) = _aliceRun();
        vm.prank(alice);
        kicau.transferFrom(alice, bob, tokenId);
        vm.warp(block.timestamp + 10);
        vm.prank(alice);
        vm.expectRevert(Kicau.NotBirdOwner.selector);
        kicau.submitRun(runId, 1);
    }

    function test_RevertStartRunNotOwner() public {
        vm.prank(alice);
        uint256 tokenId = kicau.buy{value: 0.01 ether}(0);
        vm.prank(bob);
        vm.expectRevert(Kicau.NotBirdOwner.selector);
        kicau.startRun(tokenId);
    }

    function test_RevertRunExpired() public {
        (, uint256 runId,) = _aliceRun();
        vm.warp(block.timestamp + 1 hours + 1);
        vm.prank(alice);
        vm.expectRevert(Kicau.RunExpired.selector);
        kicau.submitRun(runId, 1);
    }

    function test_NewRunClosesPrevious() public {
        (uint256 tokenId, uint256 runId,) = _aliceRun();
        vm.prank(alice);
        (uint256 runId2, uint256 seed2) = kicau.startRun(tokenId);
        assertEq(runId2, runId + 1);
        assertTrue(seed2 != 0);
        assertEq(kicau.activeRunOf(alice), runId2);
        vm.warp(block.timestamp + 10);
        vm.startPrank(alice);
        vm.expectRevert(Kicau.RunNotActive.selector);
        kicau.submitRun(runId, 1);
        kicau.submitRun(runId2, 1);
        vm.stopPrank();
    }

    function test_LeaderboardV2() public {
        (, uint256 runId,) = _aliceRun();
        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        kicau.submitRun(runId, 25);

        vm.startPrank(bob);
        uint256 bobToken = kicau.buy{value: 0.01 ether}(0);
        kicau.submitScore(bobToken, 99, 2);
        vm.stopPrank();

        (address[] memory players, uint256[] memory best, uint256[] memory validated) = kicau.getLeaderboardV2();
        assertEq(players.length, 2);
        assertEq(players[0], alice);
        assertEq(best[0], 25);
        assertEq(validated[0], 25);
        assertEq(players[1], bob);
        assertEq(best[1], 99);
        assertEq(validated[1], 0);
    }

    function testFuzz_RunTimeBound(uint32 elapsed, uint256 score) public {
        elapsed = uint32(bound(elapsed, 0, 1 hours));
        score = bound(score, 0, 10_000);
        (, uint256 runId,) = _aliceRun();
        vm.warp(block.timestamp + elapsed);
        vm.prank(alice);
        if (score * 1000 > uint256(elapsed) * 1000 + 3000) {
            vm.expectRevert(Kicau.ScoreTooFast.selector);
            kicau.submitRun(runId, score);
        } else {
            kicau.submitRun(runId, score);
            assertEq(kicau.bestValidatedByPlayer(alice), score);
        }
    }

    function test_SupportBirdPaysKeeperAndConservation() public {
        vm.prank(alice);
        uint256 id = kicau.registerBird{value: 0.005 ether}("Si Jambul", hex"4b4301");
        uint256 aliceBefore = alice.balance;
        uint256 consBefore = conservation.balance;

        vm.prank(bob);
        kicau.supportBird{value: 0.1 ether}(id);

        assertEq(alice.balance - aliceBefore, 0.07 ether);
        assertEq(conservation.balance - consBefore, 0.03 ether);
        assertEq(kicau.birdSupportOf(id), 0.1 ether);
        assertEq(kicau.birdSupporters(id), 1);
        assertEq(address(kicau).balance, 0);

        // keeper share follows the NFT: transfer, then support again
        vm.prank(alice);
        kicau.transferFrom(alice, bob, id);
        uint256 bobBefore = bob.balance;
        vm.deal(address(this), 1 ether);
        kicau.supportBird{value: 0.01 ether}(id);
        assertEq(bob.balance - bobBefore, 0.007 ether);
    }

    function test_RevertSupportBirdInvalid() public {
        vm.prank(alice);
        uint256 kenari = kicau.buy{value: 0.01 ether}(0);
        vm.expectRevert(Kicau.NotCustomBird.selector);
        kicau.supportBird{value: 0.01 ether}(kenari);

        vm.prank(alice);
        uint256 id = kicau.registerBird{value: 0.005 ether}("x", hex"01");
        vm.expectRevert(Kicau.WrongPayment.selector);
        kicau.supportBird{value: 0}(id);
    }
}
