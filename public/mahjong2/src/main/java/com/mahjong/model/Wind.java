package com.mahjong.model;

public enum Wind {
    EAST("東", 1), SOUTH("南", 2), WEST("西", 3), NORTH("北", 4);

    private final String chineseName;
    private final int value;

    Wind(String n, int v) { this.chineseName = n; this.value = v; }
    public String getChineseName() { return chineseName; }
    public int getValue() { return value; }

    public Wind next() {
        return switch (this) {
            case EAST  -> SOUTH;
            case SOUTH -> WEST;
            case WEST  -> NORTH;
            case NORTH -> EAST;
        };
    }

    /** FENG tile value matching this wind */
    public int toTileValue() { return value; }
}
