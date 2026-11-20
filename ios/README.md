# Route Scout for iPhone

Route Scout follows the printed order of an existing `.route.json` packet. The
iPhone app needs iOS 18 or later and opens with a fictional practice route. Use
**Next step** on driving instructions and **Service done** on delivery steps.
**Steps** lets you search streets, notes, or a step number such as `#12`. Tap a
step to go to it. The app saves your place when you advance, go back, or jump.

## Run from Xcode

1. Open `RouteScout.xcodeproj`, select the **RouteScout** scheme, and choose
   an iPhone simulator. Press **⌘R** to run with the practice route.
2. For an iPhone, connect or pair it with the Mac and sign in under **Xcode →
   Settings → Accounts**. In the **RouteScout** app target’s **Signing &
   Capabilities**, select your team. A Personal Team can sign a local test
   build. Select the iPhone as the run destination, enable **Developer Mode**
   if prompted, and press **⌘R**. See [Apple’s device setup guide](https://developer.apple.com/documentation/xcode/building-and-running-an-app).
3. Put your existing `.route.json` in **Files** on your iPhone. In Route Scout,
   open **Settings → Import route**, then choose the file. The app copies it
   to its own local storage. You can remove that copy in Route Scout settings.

## First test on your iPhone

- Verify the packet’s step count, a long instruction, a service step, a step
  with no pin, and the last step. You can return to step 1 from Settings.
- Open **Map**, tap **Enable GPS**, and choose **Allow While Using App**. On
  the route, check that the dot is near your actual position. Both the dot and
  step pins are approximate. The app keeps the same step until you move it.
- Use **Repeat** to try speech. Enable **Spoken directions** in Settings if
  you want the app to read instructions when you advance. Use an installed
  system voice. GPS and speech pause when the app leaves the foreground.
- Enable airplane mode, close and reopen Route Scout, and check the packet,
  map, bookmark, and speech. The native app starts with its own bookmark;
  progress from Safari does not transfer. The last step leads to **End of
  packet**; this is a bookmark at the end, rather than a delivery log.

Only the fictional packet is bundled. The imported packet and bookmark stay
on the iPhone, excluded from backups. There is no cloud sync or GPS history.
The existing web app can still be used independently.

## Development

The app uses the local `RouteScoutCore` Swift package, with no dependencies to
download. Run `swift test --package-path ios` from the workspace root for
packet, map, and progress tests. In Xcode, choose an iPhone simulator and press
**⌘U** to run the UI tests. For simulated GPS in the practice map, use a
location near latitude 45, longitude −123.0015.
