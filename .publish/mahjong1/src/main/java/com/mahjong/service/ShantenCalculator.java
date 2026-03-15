package com.mahjong.service;

import com.mahjong.model.MeldGroup;
import com.mahjong.model.Tile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

import java.util.List;

/**
 * Calculates the shanten number (向聽數) of a hand.
 * -1 = already won (complete hand)
 *  0 = tenpai (one tile away from winning)
 *  n = n tiles away from tenpai
 *
 * Uses an array-based representation for performance:
 * Index 0-8:  1-9 萬
 * Index 9-17: 1-9 筒
 * Index 18-26: 1-9 索
 * Index 27-30: 東南西北
 * Index 31-33: 中發白
 */
@Component
public class ShantenCalculator {

    private static final int TILE_TYPES = 34;

    /** Convert hand tiles to count array (ignoring flower tiles) */
    public int[] toCountArray(List<Tile> tiles) {
        int[] counts = new int[TILE_TYPES];
        for (Tile t : tiles) {
            int idx = t.toIndex();
            if (idx >= 0) counts[idx]++;
        }
        return counts;
    }

    /**
     * Calculate shanten for the full hand (hand + drawn tile = 13/14 tiles).
     * Exposed melds reduce the number of melds needed.
     */
    public int calculate(List<Tile> hand, List<MeldGroup> exposed) {
        int exposedMelds = (int) exposed.stream()
            .filter(m -> m.getType() != null)
            .count();
        // Quads don't count as melds for shanten (they're supplements)
        int meldsFilled = (int) exposed.stream()
            .filter(m -> m.getType() != null && m.getType().name().equals("QUAD") == false)
            .count();

        // Filter flowers from hand
        List<Tile> effective = hand.stream().filter(t -> !t.isFlower()).toList();
        int[] counts = toCountArray(effective);

        int standard = standardShanten(counts, 4 - exposedMelds);
        int sevenPairs = (exposedMelds == 0) ? sevenPairsShanten(counts) : 8;

        return Math.min(standard, sevenPairs);
    }

    public int calculateFromCounts(int[] counts, int meldGroupsNeeded) {
        int standard = standardShanten(counts, meldGroupsNeeded);
        int sevenPairs = sevenPairsShanten(counts);
        return Math.min(standard, sevenPairs);
    }

    // ── Seven Pairs shanten ────────────────────────────────────────

    public int sevenPairsShanten(int[] counts) {
        int pairs = 0, uniq = 0;
        for (int c : counts) {
            if (c >= 2) pairs++;
            if (c > 0)  uniq++;
        }
        // need 7 pairs; each extra pair of a kind we already have reduces shanten
        return Math.max(6 - pairs, 13 - uniq - pairs);
    }

    // ── Standard hand shanten ──────────────────────────────────────

    private int standardShanten(int[] counts, int meldGroupsNeeded) {
        // state: [shanten, melds, partial, hasHead]
        int[] best = {8};
        for (int i = 0; i < TILE_TYPES; i++) {
            if (counts[i] >= 2) {
                counts[i] -= 2;
                calcMelds(counts, meldGroupsNeeded, 0, 0, true, best);
                counts[i] += 2;
            }
        }
        calcMelds(counts, meldGroupsNeeded, 0, 0, false, best);
        return best[0];
    }

    /**
     * Recursive scan: try to build melds and partial groups from counts[].
     * pos = current tile index being considered.
     */
    private void calcMelds(int[] counts, int meldGroupsNeeded,
                            int pos, int melds, boolean hasHead,
                            int[] best) {
        // shanten formula: 8 - 2*melds - partial - (hasHead?1:0)
        // We'll track partial implicitly by computing remaining tiles
        // Simpler: just recurse and tally up
        if (pos == TILE_TYPES) {
            int s = (meldGroupsNeeded - melds) * 2 - (hasHead ? 1 : 0) - 1;
            // s = shanten: melds*2 needed, partial reduces by 1, head reduces by 1
            // Actually use standard formula:
            s = 8 - 2 * melds;
            if (hasHead) s -= 1;
            // count partial groups contribution
            // We've already "used" melds complete groups; remaining tiles form partials
            // Compute partial groups from remaining
            int partial = countPartials(counts, pos);
            int maxPartial = meldGroupsNeeded - melds + (hasHead ? 0 : 1);
            partial = Math.min(partial, maxPartial);
            s -= partial;
            best[0] = Math.min(best[0], s);
            return;
        }

        if (counts[pos] == 0) {
            calcMelds(counts, meldGroupsNeeded, pos + 1, melds, hasHead, best);
            return;
        }

        // Early exit: can't do better
        if (best[0] == -1) return;

        // Option 1: use as triplet
        if (counts[pos] >= 3 && melds < meldGroupsNeeded) {
            counts[pos] -= 3;
            calcMelds(counts, meldGroupsNeeded, pos, melds + 1, hasHead, best);
            counts[pos] += 3;
        }

        // Option 2: use as sequence (only number tiles)
        if (pos < 27) {
            int suit = pos / 9;
            int posInSuit = pos % 9;
            if (posInSuit <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0 && melds < meldGroupsNeeded) {
                counts[pos]--;
                counts[pos + 1]--;
                counts[pos + 2]--;
                calcMelds(counts, meldGroupsNeeded, pos, melds + 1, hasHead, best);
                counts[pos]++;
                counts[pos + 1]++;
                counts[pos + 2]++;
            }
        }

        // Skip (isolated tile)
        calcMelds(counts, meldGroupsNeeded, pos + 1, melds, hasHead, best);
    }

    /** Count partial groups (pairs and adjacent tiles) in remaining positions */
    private int countPartials(int[] counts, int fromPos) {
        int partial = 0;
        boolean[] used = new boolean[TILE_TYPES];
        for (int i = fromPos; i < TILE_TYPES; i++) {
            if (counts[i] == 0 || used[i]) continue;
            // pair
            if (counts[i] >= 2) { partial++; used[i] = true; continue; }
            // kanchan / penchan
            if (i < 27 && i % 9 <= 7 && counts[i + 1] > 0) { partial++; used[i] = used[i+1] = true; continue; }
            if (i < 27 && i % 9 <= 6 && counts[i + 2] > 0) { partial++; used[i] = used[i+2] = true; }
        }
        return partial;
    }

    // ── Public utility ─────────────────────────────────────────────

    /** Whether a hand of 13 tiles is tenpai (shanten == 0) */
    public boolean isTenpai(List<Tile> hand, List<MeldGroup> exposed) {
        return calculate(hand, exposed) == 0;
    }

    /** Return list of tile indices that would complete the hand (tenpai → win) */
    public List<Integer> waitingTileIndices(List<Tile> hand, List<MeldGroup> exposed) {
        int[] base = toCountArray(hand.stream().filter(t -> !t.isFlower()).toList());
        java.util.List<Integer> waits = new java.util.ArrayList<>();
        for (int i = 0; i < TILE_TYPES; i++) {
            if (base[i] >= 4) continue;
            base[i]++;
            int s = calculateFromCounts(base, 4 - exposed.size());
            base[i]--;
            if (s == -1) waits.add(i);
        }
        return waits;
    }
}
