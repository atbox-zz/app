package com.mahjong.security;

import com.mahjong.model.User;
import com.mahjong.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
public class OAuth2SuccessHandler implements AuthenticationSuccessHandler {

    @Value("${app.frontend-url}")
    private String frontendUrl;

    private final AuthService authService;

    public OAuth2SuccessHandler(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request,
                                        HttpServletResponse response,
                                        Authentication authentication)
            throws IOException {

        var oauthUser = (OAuth2User) authentication.getPrincipal();

        // Detect provider from request URI
        String uri = request.getRequestURI();
        User.AuthProvider provider = uri.contains("google")
            ? User.AuthProvider.GOOGLE : User.AuthProvider.FACEBOOK;

        String providerId = oauthUser.getAttribute("sub") != null
            ? oauthUser.getAttribute("sub")         // Google
            : oauthUser.getAttribute("id");          // Facebook

        String email     = oauthUser.getAttribute("email");
        String name      = oauthUser.getAttribute("name");
        String avatarUrl = oauthUser.getAttribute("picture");

        var authResponse = authService.processOAuth2(providerId, provider, email, name, avatarUrl);

        // Redirect to frontend with token in URL fragment
        String redirectUrl = frontendUrl + "/#token=" + authResponse.token()
            + "&refresh=" + authResponse.refreshToken();
        response.sendRedirect(redirectUrl);
    }
}
