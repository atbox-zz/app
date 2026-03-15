package com.mahjong.controller;

import com.mahjong.model.GameState;
import com.mahjong.model.PlayerAction;
import com.mahjong.service.GameService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/game")
@CrossOrigin(origins = "*")
public class GameController {

    private final GameService gameService;

    public GameController(GameService gameService) {
        this.gameService = gameService;
    }

    /** POST /api/game/start  body: { aiLevel: 2, totalRounds: 8 } */
    @PostMapping("/start")
    public ResponseEntity<GameState> startGame(@RequestBody Map<String, Integer> params) {
        int aiLevel     = params.getOrDefault("aiLevel", 2);
        int totalRounds = params.getOrDefault("totalRounds", 4);
        return ResponseEntity.ok(gameService.startGame(aiLevel, totalRounds));
    }

    /** GET /api/game/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<GameState> getState(@PathVariable String id) {
        return ResponseEntity.ok(gameService.getState(id));
    }

    /** POST /api/game/{id}/action  body: PlayerAction */
    @PostMapping("/{id}/action")
    public ResponseEntity<GameState> performAction(@PathVariable String id,
                                                    @RequestBody PlayerAction action) {
        return ResponseEntity.ok(gameService.performAction(id, action));
    }

    /** POST /api/game/{id}/next-round */
    @PostMapping("/{id}/next-round")
    public ResponseEntity<GameState> nextRound(@PathVariable String id) {
        return ResponseEntity.ok(gameService.nextRound(id));
    }
}
