package com.mahjong.model;

import java.util.Objects;

public class Tile {
    private String id;
    private TileSuit suit;
    private int value;
    private boolean hidden;

    public Tile() {}

    public Tile(String id, TileSuit suit, int value) {
        this.id = id;
        this.suit = suit;
        this.value = value;
    }

    // ── Derived helpers ─────────────────────────────────────────────

    public boolean isFlower() { return suit == TileSuit.HUA; }

    public boolean isHonor() { return suit == TileSuit.FENG || suit == TileSuit.JIAN; }

    public boolean isTerminal() { return suit.isNumber() && (value == 1 || value == 9); }

    public boolean isYaoJiu() { return isTerminal() || isHonor(); }

    /** Index in 0-33 space (WAN 0-8, TONG 9-17, SUO 18-26, FENG 27-30, JIAN 31-33) */
    public int toIndex() {
        return switch (suit) {
            case WAN  -> value - 1;
            case TONG -> 9  + value - 1;
            case SUO  -> 18 + value - 1;
            case FENG -> 27 + value - 1;
            case JIAN -> 31 + value - 1;
            case HUA  -> -1;
        };
    }

    public static Tile fromIndex(int idx) {
        if (idx <  9) return new Tile("", TileSuit.WAN,  idx + 1);
        if (idx < 18) return new Tile("", TileSuit.TONG, idx - 9  + 1);
        if (idx < 27) return new Tile("", TileSuit.SUO,  idx - 18 + 1);
        if (idx < 31) return new Tile("", TileSuit.FENG, idx - 27 + 1);
        return           new Tile("", TileSuit.JIAN, idx - 31 + 1);
    }

    // ── Display ──────────────────────────────────────────────────────

    public String getDisplayNameInternal() {
        return switch (suit) {
            case WAN  -> value + "萬";
            case TONG -> value + "筒";
            case SUO  -> value + "索";
            case FENG -> switch (value) { case 1->"東"; case 2->"南"; case 3->"西"; case 4->"北"; default->"?風"; };
            case JIAN -> switch (value) { case 1->"中"; case 2->"發"; case 3->"白"; default->"?"; };
            case HUA  -> switch (value) { case 1->"梅"; case 2->"蘭"; case 3->"菊"; case 4->"竹";
                                          case 5->"春"; case 6->"夏"; case 7->"秋"; case 8->"冬"; default->"花"; };
        };
    }

    public String getSymbolInternal() {
        return switch (suit) {
            case WAN  -> switch (value) { case 1->"🀇";case 2->"🀈";case 3->"🀉";case 4->"🀊";case 5->"🀋";
                                          case 6->"🀌";case 7->"🀍";case 8->"🀎";case 9->"🀏"; default->"?"; };
            case TONG -> switch (value) { case 1->"🀙";case 2->"🀚";case 3->"🀛";case 4->"🀜";case 5->"🀝";
                                          case 6->"🀞";case 7->"🀟";case 8->"🀠";case 9->"🀡"; default->"?"; };
            case SUO  -> switch (value) { case 1->"🀐";case 2->"🀑";case 3->"🀒";case 4->"🀓";case 5->"🀔";
                                          case 6->"🀕";case 7->"🀖";case 8->"🀗";case 9->"🀘"; default->"?"; };
            case FENG -> switch (value) { case 1->"🀀";case 2->"🀁";case 3->"🀂";case 4->"🀃"; default->"?"; };
            case JIAN -> switch (value) { case 1->"🀄";case 2->"🀅";case 3->"🀆"; default->"?"; };
            case HUA  -> "🌸";
        };
    }


    // ── equals / hashCode by suit+value (ignoring id) ────────────────
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Tile t)) return false;
        return value == t.value && suit == t.suit;
    }

    @Override
    public int hashCode() { return Objects.hash(suit, value); }

    @Override
    public String toString() { return getDisplayNameInternal() + "(" + id + ")"; }

    // ── Getters / Setters ────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public TileSuit getSuit() { return suit; }
    public void setSuit(TileSuit suit) { this.suit = suit; }
    public int getValue() { return value; }
    public void setValue(int value) { this.value = value; }
    public boolean isHidden() { return hidden; }
    public void setHidden(boolean hidden) { this.hidden = hidden; }
    // Computed display fields (serialized to JSON automatically)
    public String getSymbol() { return hidden ? "🀫" : getSymbolInternal(); }
    public String getDisplayName() { return hidden ? "?" : getDisplayNameInternal(); }
}
