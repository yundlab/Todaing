/**
 * `scripts/extract-app-shell-parts.mjs` embeds TS that imports UserIcon/WalletIcon from `@/components/icons`.
 * Those snippets are not part of the static module graph; this entry keeps knip aware of that surface.
 */
import { UserIcon } from "./UserIcon";
import { WalletIcon } from "./WalletIcon";

void UserIcon;
void WalletIcon;
