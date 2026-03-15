package com.mahjong.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class IndexController {
    @GetMapping(value = {"/", "/lobby", "/game/**"})
    public String index() { return "forward:/index.html"; }
}
