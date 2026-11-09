/**
 * CSS-only Vite entry for the server-rendered Twig pages (/platform, /help).
 *
 * It is a .tsx file holding a single import because src/Twig/ViteExtension.php
 * resolves manifest entries by the hardcoded needle `assets/<entry>.tsx` — a
 * bare .css input would never be found. The compiled JS is a near-empty stub;
 * the templates still emit its script tag unconditionally, because in dev mode
 * the stylesheet arrives through that tag rather than through a <link>.
 */
import "./styles/site.css";
