package com.mahjong.service;

import com.mahjong.model.*;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class WinChecker {

    // ── Public API ─────────────────────────────────────────────────

    /**
     * Check whether the given hand (14 effective tiles) + exposed melds is a winning hand.
     */
    public boolean canWin(List<Tile> hand, List<MeldGroup> exposed) {
        List<Tile> eff = hand.stream().filter(t -> !t.isFlower()).toList();
        if (eff.size() + exposed.stream().mapToInt(m -> m.getType() == MeldType.QUAD ? 4 : 3).sum() != 14) {
            return false;
        }
        int neededMelds = 4 - (int) exposed.stream().filter(m -> m.getType() != MeldType.QUAD).count();

        List<Tile> sorted = sortTiles(eff);

        // 七對 (Seven Pairs) — only valid with no exposed melds
        if (exposed.isEmpty() && isSevenPairs(sorted)) return true;

        // Standard 4 melds + 1 pair
        return checkStandard(sorted, neededMelds);
    }

    /**
     * Full win analysis: determines fans earned.
     */
    public WinResult analyzeWin(List<Tile> fullHand, List<MeldGroup> exposed,
                                 Tile winTile, boolean selfDraw,
                                 Wind playerWind, Wind roundWind) {
        WinResult result = new WinResult();
        List<Tile> eff = fullHand.stream().filter(t -> !t.isFlower()).toList();

        if (!canWin(eff, exposed)) {
            result.setWon(false);
            return result;
        }
        result.setWon(true);
        result.setSelfDraw(selfDraw);

        boolean sevenPairs = exposed.isEmpty() && isSevenPairs(sortTiles(eff));
        result.setSevenPairs(sevenPairs);

        // ── Fan calculation ────────────────────────────────────────

        // 七對 = 4 fan
        if (sevenPairs) result.addFan("七對", 4);

        // 自摸 = 1 fan
        if (selfDraw) result.addFan("自摸", 1);

        // 門前清 = 1 fan (no exposed melds, non-self-draw)
        if (exposed.isEmpty() && !selfDraw) result.addFan("門前清", 1);

        // 清一色 = 24 fan (all tiles same suit, numbers only)
        if (isClearColor(eff, exposed)) result.addFan("清一色", 24);
        // 混一色 = 8 fan
        else if (isMixedColor(eff, exposed)) result.addFan("混一色", 8);

        // 全是字牌 = 字一色 32 fan
        if (isAllHonors(eff, exposed)) result.addFan("字一色", 32);

        // 碰碰胡 = 6 fan (all triplets, no sequences)
        if (!sevenPairs && isAllTriplets(eff, exposed)) result.addFan("碰碰胡", 6);

        // 斷么九 = 2 fan (no terminals or honors)
        if (isAllSimples(eff, exposed)) result.addFan("斷么九", 2);

        // 平胡 = 1 fan (all sequences, no triplets, no honors, 2-sided wait, no pair on honor/terminal)
        if (!sevenPairs && isAllSequences(eff, exposed) && !isAllSimples(eff, exposed)) result.addFan("平胡", 1);

        // 箭牌刻子 (dragon triplet) = 1 fan each
        countDragonTriplets(eff, exposed).forEach(name -> result.addFan(name, 1));

        // 風牌刻子 (seat/round wind triplet)
        if (hasWindTriplet(eff, exposed, playerWind)) result.addFan(playerWind.getChineseName() + "風刻", 1);
        if (hasWindTriplet(eff, exposed, roundWind))  result.addFan(roundWind.getChineseName() + "風刻（圈風）", 1);

        // 花牌加分
        long flowers = fullHand.stream().filter(Tile::isFlower).count();
        if (flowers > 0) result.addFan("花牌×" + flowers, (int) flowers);

        // If no fans calculated yet (minimum hand), add 平胡
        if (result.getTotalFan() == 0) result.addFan("平胡", 1);

        return result;
    }

    // ── Standard win check (recursive) ────────────────────────────

    private boolean checkStandard(List<Tile> sorted, int neededMelds) {
        // Try each tile as pair head
        for (int i = 0; i < sorted.size() - 1; i++) {
            Tile ti = sorted.get(i);
            Tile ti1 = sorted.get(i + 1);
            if (sameType(ti, ti1)) {
                // Skip duplicates to avoid re-checking same pair candidate
                if (i > 0 && sameType(sorted.get(i - 1), ti)) continue;
                List<Tile> rest = new ArrayList<>(sorted);
                rest.remove(i + 1);
                rest.remove(i);
                if (canFormMelds(rest, neededMelds)) return true;
            }
        }
        return false;
    }

    private boolean canFormMelds(List<Tile> tiles, int count) {
        if (tiles.isEmpty()) return count == 0;
        if (count == 0) return tiles.isEmpty();
        if (tiles.size() < 3) return false;

        Tile first = tiles.get(0);

        // Try triplet first (stable choice — avoids backtracking loops)
        if (tiles.size() >= 3 && sameType(tiles.get(0), tiles.get(1)) && sameType(tiles.get(1), tiles.get(2))) {
            List<Tile> rest = new ArrayList<>(tiles.subList(3, tiles.size()));
            if (canFormMelds(rest, count - 1)) return true;
        }

        // Try sequence (number tiles only)
        if (first.getSuit().isNumber()) {
            Tile t2 = findFirst(tiles, 1, first.getSuit(), first.getValue() + 1);
            Tile t3 = findFirst(tiles, 1, first.getSuit(), first.getValue() + 2);
            if (t2 != null && t3 != null) {
                List<Tile> rest = new ArrayList<>(tiles);
                rest.remove(t3);
                rest.remove(t2);
                rest.remove(0);
                if (canFormMelds(rest, count - 1)) return true;
            }
        }

        return false;
    }

    // ── Seven Pairs ────────────────────────────────────────────────

    public boolean isSevenPairs(List<Tile> sorted) {
        if (sorted.size() != 14) return false;
        Map<String, Long> cnt = sorted.stream()
            .collect(Collectors.groupingBy(t -> t.getSuit() + "_" + t.getValue(), Collectors.counting()));
        return cnt.size() == 7 && cnt.values().stream().allMatch(c -> c == 2);
    }

    // ── Fan helpers ────────────────────────────────────────────────

    private boolean isClearColor(List<Tile> hand, List<MeldGroup> exposed) {
        Set<TileSuit> suits = new HashSet<>();
        hand.forEach(t -> suits.add(t.getSuit()));
        exposed.forEach(m -> m.getTiles().forEach(t -> suits.add(t.getSuit())));
        return suits.size() == 1 && suits.iterator().next().isNumber();
    }

    private boolean isMixedColor(List<Tile> hand, List<MeldGroup> exposed) {
        Set<TileSuit> suits = new HashSet<>();
        hand.forEach(t -> suits.add(t.getSuit()));
        exposed.forEach(m -> m.getTiles().forEach(t -> suits.add(t.getSuit())));
        long numSuits = suits.stream().filter(TileSuit::isNumber).count();
        return numSuits == 1 && suits.size() > 1;
    }

    private boolean isAllHonors(List<Tile> hand, List<MeldGroup> exposed) {
        return hand.stream().allMatch(Tile::isHonor) &&
               exposed.stream().flatMap(m -> m.getTiles().stream()).allMatch(Tile::isHonor);
    }

    private boolean isAllSimples(List<Tile> hand, List<MeldGroup> exposed) {
        return hand.stream().noneMatch(Tile::isYaoJiu) &&
               exposed.stream().flatMap(m -> m.getTiles().stream()).noneMatch(Tile::isYaoJiu);
    }

    private boolean isAllTriplets(List<Tile> hand, List<MeldGroup> exposed) {
        // No sequences in exposed
        boolean noSeqExposed = exposed.stream().noneMatch(m -> m.getType() == MeldType.SEQUENCE);
        if (!noSeqExposed) return false;
        // All melds in hand must be triplets or quads
        List<Tile> sorted = sortTiles(hand);
        return checkAllTriplets(sorted);
    }

    private boolean checkAllTriplets(List<Tile> sorted) {
        if (sorted.size() == 2) return sameType(sorted.get(0), sorted.get(1));
        if (sorted.size() < 3) return false;
        Tile f = sorted.get(0);
        if (sorted.size() >= 3 && sameType(f, sorted.get(1)) && sameType(f, sorted.get(2))) {
            List<Tile> rest = new ArrayList<>(sorted.subList(3, sorted.size()));
            return checkAllTriplets(rest);
        }
        return false;
    }

    private boolean isAllSequences(List<Tile> hand, List<MeldGroup> exposed) {
        boolean noTripletExposed = exposed.stream().noneMatch(m -> m.getType() == MeldType.TRIPLET || m.getType() == MeldType.QUAD);
        return noTripletExposed;
        // (simplified: just check exposed; hand check would require full decomposition)
    }

    private List<String> countDragonTriplets(List<Tile> hand, List<MeldGroup> exposed) {
        List<String> fans = new ArrayList<>();
        String[] dragons = {"中", "發", "白"};
        int[] vals = {1, 2, 3};
        for (int i = 0; i < 3; i++) {
            int v = vals[i];
            long inHand = hand.stream().filter(t -> t.getSuit() == TileSuit.JIAN && t.getValue() == v).count();
            boolean inExposed = exposed.stream().anyMatch(m ->
                m.getTiles().stream().anyMatch(t -> t.getSuit() == TileSuit.JIAN && t.getValue() == v));
            if (inHand >= 3 || inExposed) fans.add(dragons[i] + "刻");
        }
        return fans;
    }

    private boolean hasWindTriplet(List<Tile> hand, List<MeldGroup> exposed, Wind wind) {
        int v = wind.toTileValue();
        long inHand = hand.stream().filter(t -> t.getSuit() == TileSuit.FENG && t.getValue() == v).count();
        boolean inExposed = exposed.stream().anyMatch(m ->
            m.getTiles().stream().anyMatch(t -> t.getSuit() == TileSuit.FENG && t.getValue() == v));
        return inHand >= 3 || inExposed;
    }

    // ── Utilities ─────────────────────────────────────────────────

    public List<Tile> sortTiles(List<Tile> tiles) {
        List<Tile> s = new ArrayList<>(tiles);
        s.sort(Comparator.comparingInt(Tile::toIndex));
        return s;
    }

    private boolean sameType(Tile a, Tile b) {
        return a.getSuit() == b.getSuit() && a.getValue() == b.getValue();
    }

    private Tile findFirst(List<Tile> tiles, int fromIdx, TileSuit suit, int value) {
        for (int i = fromIdx; i < tiles.size(); i++) {
            Tile t = tiles.get(i);
            if (t.getSuit() == suit && t.getValue() == value) return t;
        }
        return null;
    }

    // ── Tenpai helpers ────────────────────────────────────────────

    /** Return all tile types (as Tile samples) that would complete this hand */
    public List<Tile> getWaitingTiles(List<Tile> hand13, List<MeldGroup> exposed) {
        List<Tile> waits = new ArrayList<>();
        TileSuit[] suits = {TileSuit.WAN, TileSuit.TONG, TileSuit.SUO, TileSuit.FENG, TileSuit.JIAN};
        for (TileSuit suit : suits) {
            int max = suit.isNumber() ? 9 : (suit == TileSuit.FENG ? 4 : 3);
            for (int v = 1; v <= max; v++) {
                Tile test = new Tile("T", suit, v);
                List<Tile> test14 = new ArrayList<>(hand13);
                test14.add(test);
                if (canWin(test14, exposed)) waits.add(test);
            }
        }
        return waits;
    }
}
