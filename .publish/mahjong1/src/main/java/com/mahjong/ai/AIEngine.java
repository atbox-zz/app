package com.mahjong.ai;

import com.mahjong.model.*;
import com.mahjong.service.ShantenCalculator;
import com.mahjong.service.WinChecker;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class AIEngine {

    private final ShantenCalculator shanten;
    private final WinChecker winChecker;
    private final Random rng = new Random();

    public AIEngine(ShantenCalculator shanten, WinChecker winChecker) {
        this.shanten = shanten;
        this.winChecker = winChecker;
    }

    // ── Discard Decision ─────────────────────────────────────────────

    /** Choose which tile to discard. Returns the tile from hand. */
    public Tile chooseDiscard(Player player, GameState state) {
        List<Tile> hand = player.getHand();
        if (hand.isEmpty()) return null;

        int level = player.getAiLevel();

        // Level 1 – random
        if (level == 1) return hand.get(rng.nextInt(hand.size()));

        // Levels 2-4: minimize shanten
        Tile best = null;
        int bestShanten = Integer.MAX_VALUE;
        int bestDanger = Integer.MAX_VALUE;

        for (Tile candidate : hand) {
            List<Tile> trial = new ArrayList<>(hand);
            trial.remove(candidate);
            int s = shanten.calculate(trial, player.getExposed());

            int danger = (level >= 3) ? dangerScore(candidate, state, player) : 0;
            int score = s * 1000 + danger;

            if (score < bestShanten * 1000 + bestDanger) {
                bestShanten = s;
                bestDanger = danger;
                best = candidate;
            }
        }

        // Level 2: occasional random mistake
        if (level == 2 && rng.nextInt(10) < 2) {
            return hand.get(rng.nextInt(hand.size()));
        }

        return best != null ? best : hand.get(0);
    }

    /**
     * Danger score: how likely this discard hits an opponent's wait.
     * Higher = more dangerous.
     */
    private int dangerScore(Tile tile, GameState state, Player self) {
        int danger = 0;

        // Central number tiles (4,5,6) have more connections
        if (tile.getSuit().isNumber()) {
            int v = tile.getValue();
            if (v >= 4 && v <= 6) danger += 3;
            else if (v == 3 || v == 7) danger += 2;
        }

        // If tile already seen 3+ times, safer to discard
        long seenCount = 0;
        for (Player p : state.getPlayers()) {
            seenCount += p.getDiscards().stream().filter(t -> t.equals(tile)).count();
            seenCount += p.getExposed().stream()
                .flatMap(m -> m.getTiles().stream())
                .filter(t -> t.equals(tile)).count();
        }
        if (seenCount >= 3) danger -= 5;

        return Math.max(danger, 0);
    }

    // ── Claim Decision ────────────────────────────────────────────────

    /** Should this AI claim the discarded tile for chi? Returns chosen pair of hand tiles or null. */
    public List<Tile> decideChi(Player player, Tile discard, GameState state) {
        if (player.getAiLevel() == 1) return null; // never chi

        List<Tile> hand = player.getHand();
        List<List<Tile>> possible = findChiOptions(hand, discard);
        if (possible.isEmpty()) return null;

        // Check if chi reduces shanten
        for (List<Tile> pair : possible) {
            List<Tile> trial = new ArrayList<>(hand);
            trial.removeAll(pair);
            // We'd add discard to exposed
            List<MeldGroup> trialExp = new ArrayList<>(player.getExposed());
            List<Tile> meldTiles = new ArrayList<>(pair);
            meldTiles.add(discard);
            meldTiles.sort(Comparator.comparingInt(Tile::toIndex));
            trialExp.add(MeldGroup.sequence(meldTiles, state.getLastDiscardPlayerIndex()));
            int s = shanten.calculate(trial, trialExp);
            if (s < shanten.calculate(hand, player.getExposed())) {
                if (player.getAiLevel() >= 2) return pair;
            }
        }
        return null;
    }

    /** Should AI claim for peng (碰)? */
    public boolean decidePeng(Player player, Tile discard, GameState state) {
        if (player.getAiLevel() == 1) return rng.nextBoolean();

        long count = player.getHand().stream().filter(t -> t.equals(discard)).count();
        if (count < 2) return false;

        List<Tile> trial = new ArrayList<>(player.getHand());
        trial.remove(discard); trial.remove(discard); // remove 2
        List<MeldGroup> trialExp = new ArrayList<>(player.getExposed());
        trialExp.add(MeldGroup.triplet(List.of(discard, discard, discard), state.getLastDiscardPlayerIndex()));
        int newS = shanten.calculate(trial, trialExp);
        int curS = shanten.calculate(player.getHand(), player.getExposed());

        return newS <= curS; // peng if it doesn't increase shanten
    }

    /** Should AI claim for gang (明槓)? */
    public boolean decideGang(Player player, Tile discard, GameState state) {
        if (player.getAiLevel() <= 1) return false;
        long count = player.getHand().stream().filter(t -> t.equals(discard)).count();
        return count >= 3;
    }

    /** Should AI claim for an-gang (暗槓) when drawing? Returns tile to quad, or null. */
    public Tile decideAnGang(Player player, GameState state) {
        if (player.getAiLevel() <= 1) return null;
        Map<String, Long> cnt = player.getHand().stream()
            .collect(Collectors.groupingBy(t -> t.getSuit() + "_" + t.getValue(), Collectors.counting()));
        for (Map.Entry<String, Long> e : cnt.entrySet()) {
            if (e.getValue() >= 4) {
                String[] parts = e.getKey().split("_");
                TileSuit suit = TileSuit.valueOf(parts[0]);
                int val = Integer.parseInt(parts[1]);
                return player.getHand().stream()
                    .filter(t -> t.getSuit() == suit && t.getValue() == val)
                    .findFirst().orElse(null);
            }
        }
        return null;
    }

    // ── Chi options helper ─────────────────────────────────────────────

    /** Find all pairs of hand tiles that, with 'discard', form a valid sequence */
    private List<List<Tile>> findChiOptions(List<Tile> hand, Tile discard) {
        List<List<Tile>> opts = new ArrayList<>();
        if (!discard.getSuit().isNumber()) return opts;

        int v = discard.getValue();
        TileSuit s = discard.getSuit();

        int[][] patterns = {{v - 2, v - 1}, {v - 1, v + 1}, {v + 1, v + 2}};
        for (int[] pat : patterns) {
            int v1 = pat[0], v2 = pat[1];
            if (v1 < 1 || v2 > 9) continue;
            Tile t1 = findInHand(hand, s, v1);
            Tile t2 = findInHand(hand, s, v2);
            if (t1 != null && t2 != null) opts.add(List.of(t1, t2));
        }
        return opts;
    }

    private Tile findInHand(List<Tile> hand, TileSuit suit, int value) {
        return hand.stream().filter(t -> t.getSuit() == suit && t.getValue() == value).findFirst().orElse(null);
    }

    // ── Think time ────────────────────────────────────────────────────

    /** Simulate AI thinking delay in milliseconds */
    public long thinkTime(int aiLevel) {
        return switch (aiLevel) {
            case 1 -> 300;
            case 2 -> 600 + rng.nextInt(500);
            case 3 -> 1000 + rng.nextInt(1000);
            case 4 -> 1500 + rng.nextInt(1500);
            default -> 500;
        };
    }
}
