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

    // ------------------------------------------------------------ contests (v6)

    address host = makeAddr("host");
    address judge1 = makeAddr("judge1");
    address judge2 = makeAddr("judge2");
    address dave = makeAddr("dave");

    function _birdOf(address who, string memory name) internal returns (uint256) {
        vm.deal(who, who.balance + 1 ether);
        vm.prank(who);
        return kicau.registerBird{value: 0.005 ether}(name, hex"4b4302");
    }

    function _judges() internal view returns (address[] memory j) {
        j = new address[](2);
        j[0] = judge1;
        j[1] = judge2;
    }

    function _contest(uint256 fee) internal returns (uint256) {
        vm.prank(host);
        return kicau.createContest("Piala Test", "Murai Batu", fee, _judges(), uint64(block.timestamp + 1 hours));
    }

    function _enter(uint256 cid, address who, uint256 tokenId, uint256 fee) internal {
        vm.prank(who);
        kicau.enter{value: fee}(cid, tokenId);
    }

    function _score(uint256 cid, address judge, uint256 tokenId, uint8 a, uint8 b, uint8 c, uint8 d) internal {
        vm.prank(judge);
        kicau.score(cid, tokenId, a, b, c, d);
    }

    function test_ContestLifecycleAndPayouts() public {
        uint256 fee = 1001; // wei, so the 50/25/15/10 split leaves rounding dust
        uint256 a1 = _birdOf(alice, "A1");
        uint256 a2 = _birdOf(alice, "A2");
        uint256 b1 = _birdOf(bob, "B1");
        uint256 d1 = _birdOf(dave, "D1");
        uint256 cid = _contest(fee);
        assertEq(cid, 0);
        assertEq(kicau.contestCount(), 1);

        _enter(cid, alice, a1, fee);
        _enter(cid, alice, a2, fee);
        _enter(cid, bob, b1, fee);
        _enter(cid, dave, d1, fee);
        assertEq(address(kicau).balance, 4 * fee);

        vm.prank(host);
        kicau.startJudging(cid);

        // totals: b1 = 70, a2 = 60, d1 = 50, a1 = 20
        _score(cid, judge1, b1, 9, 9, 9, 9);
        _score(cid, judge2, b1, 9, 9, 8, 8);
        _score(cid, judge1, a2, 8, 8, 7, 7);
        _score(cid, judge2, a2, 8, 8, 7, 7);
        _score(cid, judge1, d1, 7, 6, 6, 6);
        _score(cid, judge2, d1, 7, 6, 6, 6);
        _score(cid, judge1, a1, 5, 5, 5, 5);
        // re-score overwrites, total stays consistent
        vm.expectEmit(true, true, true, true);
        emit Kicau.Scored(cid, b1, judge2, 70);
        _score(cid, judge2, b1, 9, 9, 8, 8);

        (uint256[] memory ids, uint256[] memory totals) = kicau.entriesOf(cid);
        assertEq(ids.length, 4);
        assertEq(totals[0], 20);
        assertEq(totals[1], 60);
        assertEq(totals[2], 70);
        assertEq(totals[3], 50);
        Kicau.JudgeScore memory js = kicau.judgeScoreOf(cid, b1, judge2);
        assertEq(js.duration, 8);
        assertTrue(js.scored);
        assertFalse(kicau.judgeScoreOf(cid, a1, judge2).scored);

        // prize follows the NFT: bob hands his winner to dave before finalize
        vm.prank(bob);
        kicau.transferFrom(bob, dave, b1);

        uint256 aliceBefore = alice.balance;
        uint256 daveBefore = dave.balance;
        uint256 consBefore = conservation.balance;
        uint256 totalConsBefore = kicau.totalConservation();
        uint256 pool = 4 * fee; // 4004

        vm.expectEmit(true, false, false, true);
        emit Kicau.ContestFinalized(cid, b1, a2, d1, pool);
        vm.prank(host);
        kicau.finalize(cid);

        // 50% 2002 + 15% 600 to dave, 25% 1001 to alice, rest (401 = 10% + dust) to conservation
        assertEq(dave.balance - daveBefore, 2002 + 600);
        assertEq(alice.balance - aliceBefore, 1001);
        assertEq(conservation.balance - consBefore, 401);
        assertEq(kicau.totalConservation() - totalConsBefore, 401);
        assertEq(address(kicau).balance, 0);

        Kicau.Contest memory c = kicau.getContest(cid);
        assertEq(uint8(c.status), uint8(Kicau.ContestStatus.Finalized));
        assertEq(c.pool, 0);
        assertEq(c.entryCount, 4);
        assertEq(c.judges.length, 2);
        assertEq(c.host, host);
        assertEq(kicau.attestationCount(b1), 0); // host is not an organizer

        vm.prank(host);
        vm.expectRevert(Kicau.BadStatus.selector);
        kicau.finalize(cid);
        vm.prank(judge1);
        vm.expectRevert(Kicau.BadStatus.selector);
        kicau.score(cid, b1, 1, 1, 1, 1);
    }

    function test_ContestAutoAttestWhenHostIsOrganizer() public {
        kicau.setOrganizer(host, "Kicau Demo Contest", true);
        uint256 a1 = _birdOf(alice, "A1");
        uint256 b1 = _birdOf(bob, "B1");
        uint256 cid = _contest(0.01 ether);
        _enter(cid, alice, a1, 0.01 ether);
        _enter(cid, bob, b1, 0.01 ether);
        vm.prank(host);
        kicau.startJudging(cid);
        _score(cid, judge1, b1, 10, 10, 10, 10);
        _score(cid, judge1, a1, 1, 1, 1, 1);

        uint256 consBefore = conservation.balance;
        uint256 aliceBefore = alice.balance;
        vm.prank(host);
        kicau.finalize(cid);

        Kicau.Attestation[] memory ab = kicau.attestationsOf(b1);
        assertEq(ab.length, 1);
        assertEq(ab[0].organizer, host);
        assertEq(ab[0].title, unicode"Juara 1 · Piala Test");
        assertEq(kicau.attestationsOf(a1)[0].title, unicode"Juara 2 · Piala Test");
        // only 2 entries: the 15% third-place share goes to conservation too (10% + 15%)
        assertEq(conservation.balance - consBefore, 0.005 ether);
        assertEq(alice.balance - aliceBefore, 0.005 ether);
    }

    function test_ContestTieEarlierEntryWins() public {
        uint256 a1 = _birdOf(alice, "A1");
        uint256 b1 = _birdOf(bob, "B1");
        uint256 d1 = _birdOf(dave, "D1");
        uint256 cid = _contest(0.01 ether);
        _enter(cid, bob, b1, 0.01 ether);
        _enter(cid, alice, a1, 0.01 ether);
        _enter(cid, dave, d1, 0.01 ether);
        vm.prank(host);
        kicau.startJudging(cid);
        _score(cid, judge1, a1, 5, 5, 5, 5);
        _score(cid, judge1, b1, 5, 5, 5, 5);
        _score(cid, judge1, d1, 5, 5, 5, 5);
        vm.expectEmit(true, false, false, true);
        emit Kicau.ContestFinalized(cid, b1, a1, d1, 0.03 ether);
        vm.prank(host);
        kicau.finalize(cid);
    }

    function test_RevertScoreGuards() public {
        uint256 a1 = _birdOf(alice, "A1");
        uint256 b1 = _birdOf(bob, "B1");
        uint256 cid = _contest(0);
        _enter(cid, alice, a1, 0);

        vm.prank(judge1);
        vm.expectRevert(Kicau.BadStatus.selector);
        kicau.score(cid, a1, 1, 1, 1, 1);

        _enter(cid, bob, b1, 0);
        vm.prank(host);
        kicau.startJudging(cid);

        vm.prank(alice);
        vm.expectRevert(Kicau.NotJudge.selector);
        kicau.score(cid, a1, 1, 1, 1, 1);
        vm.prank(host);
        vm.expectRevert(Kicau.NotJudge.selector);
        kicau.score(cid, a1, 1, 1, 1, 1);

        vm.startPrank(judge1);
        vm.expectRevert(Kicau.InvalidScore.selector);
        kicau.score(cid, a1, 11, 0, 0, 0);
        vm.expectRevert(Kicau.InvalidScore.selector);
        kicau.score(cid, a1, 0, 0, 0, 255);
        vm.expectRevert(Kicau.NotEntered.selector);
        kicau.score(cid, 999, 1, 1, 1, 1);
        kicau.score(cid, a1, 10, 10, 10, 10);
        vm.stopPrank();
        assertEq(kicau.entryTotal(cid, a1), 40);
    }

    function test_RevertEnterGuards() public {
        uint256 a1 = _birdOf(alice, "A1");
        vm.prank(alice);
        uint256 kenari = kicau.buy{value: 0.01 ether}(0);
        uint256 cid = _contest(0.01 ether);

        vm.startPrank(alice);
        vm.expectRevert(Kicau.WrongPayment.selector);
        kicau.enter{value: 0.009 ether}(cid, a1);
        vm.expectRevert(Kicau.NotCustomBird.selector);
        kicau.enter{value: 0.01 ether}(cid, kenari);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.enter{value: 0.01 ether}(7, a1);
        kicau.enter{value: 0.01 ether}(cid, a1);
        vm.expectRevert(Kicau.AlreadyEntered.selector);
        kicau.enter{value: 0.01 ether}(cid, a1);
        vm.stopPrank();

        uint256 b1 = _birdOf(bob, "B1");
        vm.prank(alice);
        vm.expectRevert(Kicau.NotBirdOwner.selector);
        kicau.enter{value: 0.01 ether}(cid, b1);

        vm.warp(block.timestamp + 1 hours);
        vm.prank(bob);
        vm.expectRevert(Kicau.EntryClosed.selector);
        kicau.enter{value: 0.01 ether}(cid, b1);
    }

    function test_RevertCreateContestInvalid() public {
        uint64 dl = uint64(block.timestamp + 1 hours);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest("", "Kenari", 0, _judges(), dl);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest("x", "", 0, _judges(), dl);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest("x", "Kenari", 0, new address[](0), dl);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest("x", "Kenari", 0, new address[](6), dl);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest("x", "Kenari", 0, _judges(), uint64(block.timestamp));
        address[] memory dup = new address[](2);
        dup[0] = judge1;
        dup[1] = judge1;
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest("x", "Kenari", 0, dup, dl);
        vm.expectRevert(Kicau.InvalidContest.selector);
        kicau.createContest(string(new bytes(65)), "Kenari", 0, _judges(), dl);
    }

    function test_RevertHostOnlyAndMinEntries() public {
        uint256 a1 = _birdOf(alice, "A1");
        uint256 cid = _contest(0);
        _enter(cid, alice, a1, 0);
        vm.prank(alice);
        vm.expectRevert(Kicau.NotHost.selector);
        kicau.startJudging(cid);
        vm.prank(host);
        vm.expectRevert(Kicau.NotEnoughEntries.selector);
        kicau.startJudging(cid);
        vm.prank(host);
        vm.expectRevert(Kicau.BadStatus.selector);
        kicau.finalize(cid);
        vm.prank(alice);
        vm.expectRevert(Kicau.NotHost.selector);
        kicau.cancelContest(cid);
    }

    function test_CancelRefundsEntrants() public {
        uint256 a1 = _birdOf(alice, "A1");
        uint256 b1 = _birdOf(bob, "B1");
        uint256 cid = _contest(0.02 ether);
        _enter(cid, alice, a1, 0.02 ether);
        _enter(cid, bob, b1, 0.02 ether);
        vm.prank(host);
        kicau.startJudging(cid);
        uint256 aliceBefore = alice.balance;
        uint256 bobBefore = bob.balance;
        vm.prank(host);
        kicau.cancelContest(cid);
        assertEq(alice.balance - aliceBefore, 0.02 ether);
        assertEq(bob.balance - bobBefore, 0.02 ether);
        assertEq(address(kicau).balance, 0);
        assertEq(uint8(kicau.getContest(cid).status), uint8(Kicau.ContestStatus.Cancelled));
        vm.prank(host);
        vm.expectRevert(Kicau.BadStatus.selector);
        kicau.cancelContest(cid);
    }

    function test_MaliciousKeeperCannotReenterOrBlock() public {
        MaliciousKeeper evil = new MaliciousKeeper(kicau);
        vm.deal(address(evil), 1 ether);
        uint256 e1 = evil.register();
        uint256 a1 = _birdOf(alice, "A1");
        uint256 cid = _contest(0.01 ether);
        evil.enter(cid, e1, 0.01 ether);
        _enter(cid, alice, a1, 0.01 ether);
        vm.prank(host);
        kicau.startJudging(cid);
        _score(cid, judge1, e1, 10, 10, 10, 10);

        uint256 aliceBefore = alice.balance;
        evil.arm(cid);
        vm.prank(host);
        kicau.finalize(cid); // evil's receive re-enters → reverts → its prize is parked in `owed`

        assertEq(alice.balance - aliceBefore, 0.005 ether);
        assertEq(kicau.owed(address(evil)), 0.01 ether);
        assertEq(address(kicau).balance, 0.01 ether);

        evil.disarm();
        uint256 evilBefore = address(evil).balance;
        evil.withdraw();
        assertEq(address(evil).balance - evilBefore, 0.01 ether);
        assertEq(address(kicau).balance, 0);
    }

    // ----------------------------------------------- living profile + Kicau Value

    function _points(uint256 id) internal view returns (uint256 p) {
        (p,) = kicau.valueOf(id);
    }

    function test_ValueBaseAndPrice() public {
        uint256 id = _birdOf(alice, "A1");
        (uint256 p, uint256 price) = kicau.valueOf(id);
        assertEq(p, 100);
        assertEq(price, 0.01 ether);
        assertEq(kicau.lastUpdated(id), block.timestamp);
        vm.prank(alice);
        uint256 kenari = kicau.buy{value: 0.01 ether}(0);
        vm.expectRevert(Kicau.NotCustomBird.selector);
        kicau.valueOf(kenari);
    }

    function test_ValueRisesWithContestWinAndAttestation() public {
        kicau.setOrganizer(host, "Kicau Demo Contest", true);
        uint256 a1 = _birdOf(alice, "A1");
        uint256 b1 = _birdOf(bob, "B1");
        uint256 cid = _contest(0.01 ether);
        _enter(cid, alice, a1, 0.01 ether);
        _enter(cid, bob, b1, 0.01 ether);
        vm.prank(host);
        kicau.startJudging(cid);
        _score(cid, judge1, b1, 10, 10, 10, 10);
        vm.prank(host);
        kicau.finalize(cid);
        // 1st: base 100 + win 250 + auto-attestation 80; 2nd: 100 + 150 + 80
        assertEq(_points(b1), 430);
        assertEq(_points(a1), 330);
        assertEq(kicau.winsOf(b1)[0], 1);
        Kicau.ValueBreakdown memory v = kicau.valueBreakdown(b1);
        assertEq(v.wins, 250);
        assertEq(v.attestations, 80);
        assertEq(v.priceWei, 430 * 0.0001 ether);

        // revoking the title removes its 80 points
        vm.prank(host);
        kicau.revokeAttestation(b1, 0);
        assertEq(_points(b1), 350);
    }

    function test_ValueRisesWithSupportAndRuns() public {
        uint256 id = _birdOf(alice, "A1");
        vm.prank(bob);
        kicau.supportBird{value: 0.1 ether}(id);
        assertEq(_points(id), 120); // +10 supporter, +100 milli-MON / 10

        vm.prank(alice);
        (uint256 runId,) = kicau.startRun(id);
        vm.warp(block.timestamp + 20);
        vm.prank(alice);
        kicau.submitRun(runId, 15);
        assertEq(kicau.bestValidatedByToken(id), 15);
        assertEq(_points(id), 150); // +30
    }

    function test_RevertSupportBelowMin() public {
        uint256 id = _birdOf(alice, "A1"); // value 0.01 MON -> min 0.001
        vm.prank(bob);
        vm.expectRevert(Kicau.BelowMinSupport.selector);
        kicau.supportBird{value: 0.0009 ether}(id);
        vm.prank(bob);
        kicau.supportBird{value: 0.001 ether}(id);
    }

    function test_ValueDecaysAndUpdateRestores() public {
        uint256 id = _birdOf(alice, "A1");
        vm.warp(block.timestamp + 7 days);
        assertEq(_points(id), 100);
        vm.warp(block.timestamp + 3 days); // 10 days -> 3 days stale -> 85%
        assertEq(_points(id), 85);
        vm.warp(block.timestamp + 20 days); // floor 30%
        assertEq(_points(id), 30);
        assertEq(kicau.valueBreakdown(id).freshnessPct, 30);

        vm.roll(block.number + 5);
        vm.expectEmit(true, true, false, true);
        emit Kicau.BirdUpdated(alice, id, 1, hex"4b4303");
        vm.prank(alice);
        kicau.updateBird(id, hex"4b4303");
        assertEq(_points(id), 100);
        assertEq(kicau.profileVersion(id), 1);
        assertEq(kicau.updatedAtBlock(id), block.number);
        assertEq(kicau.lastUpdated(id), block.timestamp);
    }

    function test_RevertUpdateBirdGuards() public {
        uint256 id = _birdOf(alice, "A1");
        vm.prank(bob);
        vm.expectRevert(Kicau.NotBirdOwner.selector);
        kicau.updateBird(id, hex"01");
        vm.startPrank(alice);
        vm.expectRevert(Kicau.InvalidBird.selector);
        kicau.updateBird(id, "");
        vm.expectRevert(Kicau.InvalidBird.selector);
        kicau.updateBird(id, new bytes(4097));
        uint256 kenari = kicau.buy{value: 0.01 ether}(0);
        vm.expectRevert(Kicau.NotCustomBird.selector);
        kicau.updateBird(kenari, hex"01");
        vm.stopPrank();
    }

    function test_GasBurnerCannotBlockCancel() public {
        MaliciousKeeper evil = new MaliciousKeeper(kicau);
        vm.deal(address(evil), 1 ether);
        uint256 e1 = evil.register();
        uint256 a1 = _birdOf(alice, "A1");
        uint256 cid = _contest(0.01 ether);
        evil.enter(cid, e1, 0.01 ether);
        _enter(cid, alice, a1, 0.01 ether);
        evil.burnGas(true);
        uint256 aliceBefore = alice.balance;
        vm.prank(host);
        kicau.cancelContest(cid);
        assertEq(alice.balance - aliceBefore, 0.01 ether);
        assertEq(kicau.owed(address(evil)), 0.01 ether);
    }
}

/// Holds a bird, enters contests and tries to re-enter Kicau when paid.
contract MaliciousKeeper {
    Kicau immutable kicau;
    uint256 armedContest = type(uint256).max;
    bool burn;

    constructor(Kicau k) {
        kicau = k;
    }

    function register() external returns (uint256) {
        return kicau.registerBird{value: 0.005 ether}("Evil", hex"4b4302");
    }

    function enter(uint256 cid, uint256 tokenId, uint256 fee) external {
        kicau.enter{value: fee}(cid, tokenId);
    }

    function arm(uint256 cid) external {
        armedContest = cid;
    }

    function disarm() external {
        armedContest = type(uint256).max;
    }

    function burnGas(bool b) external {
        burn = b;
    }

    function withdraw() external {
        kicau.withdrawOwed();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        if (burn) {
            while (true) {}
        }
        if (armedContest != type(uint256).max) {
            kicau.finalize(armedContest); // reentrancy guard (or NotHost) reverts this
        }
    }
}

/// Player contract whose receive() reverts, to exercise the owed fallback of claimWeeklyReward.
contract RejectingPlayer {
    Kicau k;
    uint256 public tokenId;
    uint256 public runId;

    constructor(Kicau k_) payable {
        k = k_;
        tokenId = k.buy{value: 0.01 ether}(0);
    }

    function start() external {
        (runId,) = k.startRun(tokenId);
    }

    function submit(uint256 s) external {
        k.submitRun(runId, s);
    }

    function claim(uint256 w) external {
        k.claimWeeklyReward(w);
    }

    function withdraw() external {
        k.withdrawOwed();
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    receive() external payable {
        if (msg.sender == address(k)) revert("no");
    }
}

contract KicauWeeklyTest is Test {
    Kicau kicau;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint256 aliceBird;
    uint256 bobBird;
    uint256 constant MONDAY = 1792972800; // 2026-10-26 00:00 UTC

    function setUp() public {
        kicau = new Kicau(makeAddr("treasury"), makeAddr("conservation"), "");
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.prank(alice);
        aliceBird = kicau.buy{value: 0.01 ether}(0);
        vm.prank(bob);
        bobBird = kicau.buy{value: 0.01 ether}(0);
        vm.warp(MONDAY + 12 hours);
    }

    function _play(address who, uint256 tokenId, uint256 s) internal {
        vm.prank(who);
        (uint256 runId,) = kicau.startRun(tokenId);
        vm.warp(block.timestamp + s);
        vm.prank(who);
        kicau.submitRun(runId, s);
    }

    function test_MondayAlignment() public {
        uint256 w = kicau.currentWeek();
        assertEq(kicau.weekStart(w), MONDAY);
        assertEq(kicau.currentDay(), MONDAY / 1 days);
        vm.warp(MONDAY - 1); // Sunday 23:59:59 belongs to the previous week
        assertEq(kicau.currentWeek(), w - 1);
        vm.warp(MONDAY + 7 days - 1);
        assertEq(kicau.currentWeek(), w);
        vm.warp(MONDAY + 7 days);
        assertEq(kicau.currentWeek(), w + 1);
    }

    function test_OnlyValidatedRunsCount() public {
        vm.prank(alice);
        kicau.submitScore(aliceBird, 500, 1); // legacy: all-time only
        (address[] memory p,) = kicau.getDailyLeaderboard(kicau.currentDay());
        assertEq(p.length, 0);
        (p,) = kicau.getWeeklyLeaderboard(kicau.currentWeek());
        assertEq(p.length, 0);
        (address leader,) = kicau.weeklyLeader(kicau.currentWeek());
        assertEq(leader, address(0));
    }

    function test_KeepsMaxAndListsPlayersOnce() public {
        uint256 d = kicau.currentDay();
        uint256 w = kicau.currentWeek();
        _play(alice, aliceBird, 5);
        _play(alice, aliceBird, 3);
        _play(bob, bobBird, 4);
        (address[] memory p, uint256[] memory s) = kicau.getDailyLeaderboard(d);
        assertEq(p.length, 2);
        assertEq(p[0], alice);
        assertEq(s[0], 5);
        assertEq(p[1], bob);
        assertEq(s[1], 4);
        (p, s) = kicau.getWeeklyLeaderboard(w);
        assertEq(p.length, 2);
        assertEq(s[0], 5);
        assertEq(kicau.weeklyBest(w, bob), 4);
        (address leader, uint256 top) = kicau.weeklyLeader(w);
        assertEq(leader, alice);
        assertEq(top, 5);
    }

    function test_ZeroScoreRunNotListed() public {
        _play(alice, aliceBird, 0);
        (address[] memory p,) = kicau.getDailyLeaderboard(kicau.currentDay());
        assertEq(p.length, 0);
    }

    function test_LeaderTieFirstKeeps() public {
        _play(alice, aliceBird, 4);
        _play(bob, bobBird, 4);
        (address leader,) = kicau.weeklyLeader(kicau.currentWeek());
        assertEq(leader, alice);
        _play(bob, bobBird, 5);
        (leader,) = kicau.weeklyLeader(kicau.currentWeek());
        assertEq(leader, bob);
    }

    function test_DayAndWeekRollover() public {
        uint256 d = kicau.currentDay();
        uint256 w = kicau.currentWeek();
        _play(alice, aliceBird, 5);
        vm.warp(MONDAY + 1 days + 1 hours); // Tuesday, same week
        _play(bob, bobBird, 3);
        (address[] memory p,) = kicau.getDailyLeaderboard(d + 1);
        assertEq(p.length, 1);
        assertEq(p[0], bob);
        (p,) = kicau.getWeeklyLeaderboard(w);
        assertEq(p.length, 2);
        vm.warp(MONDAY + 7 days + 1 hours); // next Monday
        assertEq(kicau.currentWeek(), w + 1);
        _play(bob, bobBird, 2);
        (p,) = kicau.getWeeklyLeaderboard(w + 1);
        assertEq(p.length, 1);
        (address leader, uint256 top) = kicau.weeklyLeader(w + 1);
        assertEq(leader, bob);
        assertEq(top, 2);
        (leader,) = kicau.weeklyLeader(w);
        assertEq(leader, alice);
    }

    function test_FundAndClaimHappyPath() public {
        uint256 w = kicau.currentWeek();
        vm.prank(bob);
        vm.expectEmit(true, true, false, true);
        emit Kicau.RewardsFunded(w, bob, 0.1 ether);
        kicau.fundRewards{value: 0.1 ether}(0); // 0 = current week
        vm.prank(bob);
        kicau.fundRewards{value: 0.05 ether}(w + 1); // future week ok
        assertEq(kicau.weeklyPool(w), 0.1 ether);
        assertEq(kicau.weeklyPool(w + 1), 0.05 ether);

        _play(alice, aliceBird, 5);
        _play(bob, bobBird, 3);

        vm.prank(alice);
        vm.expectRevert(Kicau.WeekNotEnded.selector);
        kicau.claimWeeklyReward(w);

        vm.warp(MONDAY + 7 days);
        vm.prank(bob);
        vm.expectRevert(Kicau.NotWinner.selector);
        kicau.claimWeeklyReward(w);

        uint256 before = alice.balance;
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit Kicau.WeeklyRewardClaimed(w, alice, 0.1 ether);
        kicau.claimWeeklyReward(w);
        assertEq(alice.balance - before, 0.1 ether);
        assertTrue(kicau.weeklyClaimed(w));
        assertEq(address(kicau).balance, 0.05 ether);

        vm.prank(alice);
        vm.expectRevert(Kicau.AlreadyClaimed.selector);
        kicau.claimWeeklyReward(w);
    }

    function test_RevertFundGuards() public {
        uint256 w = kicau.currentWeek();
        vm.prank(bob);
        vm.expectRevert(Kicau.InvalidWeek.selector);
        kicau.fundRewards{value: 1}(w - 1);
        vm.prank(bob);
        vm.expectRevert(Kicau.WrongPayment.selector);
        kicau.fundRewards(w);
    }

    function test_RolloverWhenNoPlayers() public {
        uint256 w = kicau.currentWeek();
        vm.prank(bob);
        kicau.fundRewards{value: 0.1 ether}(w);
        vm.expectRevert(Kicau.WeekNotEnded.selector);
        kicau.rolloverWeeklyPool(w);

        vm.warp(MONDAY + 14 days + 1); // two weeks later
        vm.expectEmit(true, true, false, true);
        emit Kicau.WeeklyPoolRolledOver(w, w + 2, 0.1 ether);
        kicau.rolloverWeeklyPool(w);
        assertEq(kicau.weeklyPool(w), 0);
        assertEq(kicau.weeklyPool(w + 2), 0.1 ether);
    }

    function test_RevertRolloverWithPlayers() public {
        uint256 w = kicau.currentWeek();
        _play(alice, aliceBird, 2);
        vm.warp(MONDAY + 7 days);
        vm.expectRevert(Kicau.HasPlayers.selector);
        kicau.rolloverWeeklyPool(w);
    }

    function test_FailedClaimTransferBecomesOwed() public {
        RejectingPlayer rp = new RejectingPlayer{value: 0.01 ether}(kicau);
        uint256 w = kicau.currentWeek();
        vm.prank(bob);
        kicau.fundRewards{value: 0.1 ether}(w);
        rp.start();
        vm.warp(block.timestamp + 5);
        rp.submit(5);
        vm.warp(MONDAY + 7 days);
        rp.claim(w);
        assertTrue(kicau.weeklyClaimed(w));
        assertEq(kicau.owed(address(rp)), 0.1 ether);
        vm.expectRevert(Kicau.TransferFailed.selector);
        rp.withdraw(); // still rejects; funds stay owed
        assertEq(kicau.owed(address(rp)), 0.1 ether);
    }
}
