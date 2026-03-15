package com.mahjong.model;

public class FanItem {
    private String name;
    private int fan;
    private String description;

    public FanItem() {}

    public FanItem(String name, int fan) { this.name = name; this.fan = fan; }

    public FanItem(String name, int fan, String description) {
        this.name = name; this.fan = fan; this.description = description;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public int getFan() { return fan; }
    public void setFan(int fan) { this.fan = fan; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}
