package com.mahjong.service;

import com.mahjong.model.Tile;
import com.mahjong.model.TileSuit;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class TileFactory {

    /** Create the full 144-tile set */
    public List<Tile> createFullSet() {
        List<Tile> tiles = new ArrayList<>(144);
        int id = 0;

        // 數牌 – 萬 筒 索  (9 values × 4 copies × 3 suits = 108 tiles)
        for (TileSuit suit : List.of(TileSuit.WAN, TileSuit.TONG, TileSuit.SUO)) {
            for (int v = 1; v <= 9; v++) {
                for (int copy = 0; copy < 4; copy++) {
                    tiles.add(new Tile(String.valueOf(id++), suit, v));
                }
            }
        }

        // 風牌 – 東南西北  (4 values × 4 copies = 16 tiles)
        for (int v = 1; v <= 4; v++) {
            for (int copy = 0; copy < 4; copy++) {
                tiles.add(new Tile(String.valueOf(id++), TileSuit.FENG, v));
            }
        }

        // 箭牌（三元牌）– 中發白  (3 values × 4 copies = 12 tiles)
        for (int v = 1; v <= 3; v++) {
            for (int copy = 0; copy < 4; copy++) {
                tiles.add(new Tile(String.valueOf(id++), TileSuit.JIAN, v));
            }
        }

        // 花牌 – 梅蘭菊竹春夏秋冬  (8 tiles)
        for (int v = 1; v <= 8; v++) {
            tiles.add(new Tile(String.valueOf(id++), TileSuit.HUA, v));
        }

        return tiles;
    }

    public List<Tile> createShuffled() {
        List<Tile> tiles = createFullSet();
        Collections.shuffle(tiles);
        return tiles;
    }
}
