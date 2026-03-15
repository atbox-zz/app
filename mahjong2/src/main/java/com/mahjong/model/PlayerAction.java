package com.mahjong.model;

import java.util.List;

public class PlayerAction {
    private ActionType type;
    private String tileId;            // for DISCARD / AN_GANG
    private List<String> chiTileIds;  // for CHI: 2 tiles from hand forming the sequence
    private String gangTileId;        // for JIA_GANG: the extra tile id

    public PlayerAction() {}

    public ActionType getType() { return type; }
    public void setType(ActionType type) { this.type = type; }
    public String getTileId() { return tileId; }
    public void setTileId(String tileId) { this.tileId = tileId; }
    public List<String> getChiTileIds() { return chiTileIds; }
    public void setChiTileIds(List<String> chiTileIds) { this.chiTileIds = chiTileIds; }
    public String getGangTileId() { return gangTileId; }
    public void setGangTileId(String gangTileId) { this.gangTileId = gangTileId; }
}
