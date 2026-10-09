![Logo](admin/vis2-eusec.png)

# ioBroker.vis2-eusec

Widgets for vis-2 that show the cameras of the [eusec](https://github.com/iobroker-community-adapters/ioBroker.eusec)
adapter (eufy Security). Requires eusec 3.0.2 or later.

## Widgets

- **Live camera**: plays the livestream while the widget is visible and stops it when it is not.
  Shows the last snapshot until the first picture arrives. Pan and tilt controls appear for cameras
  that have them, preset buttons from eusec 3.2.0 on.
- **Event popup**: invisible until one of its triggers turns true (by default `ringing` and
  `person_detected` of the camera, where they exist), then opens the livestream in a dialog and
  closes it after a set time. It opens only on the view it is placed on; place it on every view
  where it should appear, or in a view that all other views include.
- **Snapshot**: the last picture of the camera and its age. A tap opens the livestream.

In every widget, pick the camera channel (`eusec.0.<station>.cameras.<camera>`) as "Camera"; all
states are found from there.

## What depends on the eusec version

| eusec | Behaviour |
| --- | --- |
| 3.0.2 to 3.3.x | The widget writes `start_stream`, waits for `livestream`, and writes `stop_stream` when it closes. |
| 3.2.0 and later | Preset buttons for cameras with presets. |
| 3.4.0 and later | With "livestreams on demand" switched on, opening the player starts the stream. The player reports when the picture plays, when the station is busy with another camera and when a camera does not answer. |

## Known limits

- **HTTPS:** go2rtc serves the livestream over http only. A vis-2 page opened over https cannot
  show it; the widget says so.
- **Several displays before eusec 3.4:** a widget that closes writes `stop_stream` for a stream it
  started, which also ends the picture on another display showing the same camera. With eusec 3.4
  and livestreams on demand this does not happen.
- **Two popups at once** for two cameras stack, the newest on top.
- **Languages:** English and German; other languages show English.

## Changelog

<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**

- (typhosj) Initial version: live player, event popup and snapshot widget

## License

MIT License

Copyright (c) 2026 typhosj <typhosj@gmx.de>
