package com.mahjong.service;

import com.mahjong.model.*;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Handles score transfer between players after a win or exhaustive draw.
 * Base score = 10 points per fan.
 * Self-draw: each other player pays fan * base.
 * Ron (point-shooting): the discarder pays fan * base * 3.
 * Minimum: 8 fan to declare a win.
 */
@Component
public class ScoreCalculator {

    private static final int BASE_SCORE_PER_FAN = 10;

    /** Apply score changes for a win. Returns a description map (playerIndex -> delta). */
    public Map<Integer, Integer> applyWin(GameState state, int winnerIdx, WinResult result) {
        int fan   = Math.max(result.getTotalFan(), 8); // floor at 8 fan
        int score = fan * BASE_SCORE_PER_FAN;

        Map<Integer, Integer> deltas = new java.util.HashMap<>();
        for (int i = 0; i < 4; i++) deltas.put(i, 0);

        if (result.isSelfDraw()) {
            // Each other player pays
            for (int i = 0; i < 4; i++) {
                if (i == winnerIdx) continue;
                int payment = score;
                deltas.put(i, -payment);
                deltas.put(winnerIdx, deltas.get(winnerIdx) + payment);
            }
        } else {
            // Discarder pays triple
            int discarder = state.getLastDiscardPlayerIndex();
            int payment = score * 3;
            deltas.put(discarder, -payment);
            deltas.put(winnerIdx, payment);
        }

        result.setBaseScore(score);

        // Commit to players
        for (int i = 0; i < 4; i++) {
            Player p = state.getPlayers().get(i);
            p.setScore(p.getScore() + deltas.get(i));
        }
        return deltas;
    }

    /** Apply exhaustive draw (流局) penalties */
    public void applyExhaustiveDraw(GameState state) {
        int tenpaiCount = 0;
        for (Player p : state.getPlayers()) {
            if (p.isTenpai()) tenpaiCount++;
        }
        if (tenpaiCount == 0 || tenpaiCount == 4) return; // no transfer

        int penalty = 1000;
        for (Player p : state.getPlayers()) {
            if (!p.isTenpai()) {
                p.setScore(p.getScore() - penalty);
            } else {
                p.setScore(p.getScore() + penalty);
            }
        }
    }

    public int fanToScore(int fan) {
        return fan * BASE_SCORE_PER_FAN;
    }
}
