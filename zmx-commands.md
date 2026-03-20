# ZMX Commands

List this project's running sessions:

```bash
XDG_RUNTIME_DIR="/tmp/vamz-832d2716e9e6" "/Users/madda/Library/Application Support/Code/User/globalStorage/maddada.vsmux/zmx/0.4.2/darwin-arm64/zmx" list --short | rg '^vam2-5682b3211a49-'
```

Attach to a specific session:

```bash
XDG_RUNTIME_DIR="/tmp/vamz-832d2716e9e6" "/Users/madda/Library/Application Support/Code/User/globalStorage/maddada.vsmux/zmx/0.4.2/darwin-arm64/zmx" attach "vam2-5682b3211a49-s16"
```

Replace `vam2-5682b3211a49-s16` with the session you want.
