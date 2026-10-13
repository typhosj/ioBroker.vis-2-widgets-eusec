![Logo](admin/vis2-eusec.png)

# ioBroker.vis2-eusec

Widgets for vis-2 that show the cameras of the [eusec](https://github.com/iobroker-community-adapters/ioBroker.eusec)
adapter (eufy Security). Requires eusec 3.0.2 or later. The widgets load in vis-2 with React 18 as
well as in vis-2 with React 19.

**This project is not affiliated with Anker or eufy. eufy and eufy Security are trademarks of their
respective owners and are used here only to name the cameras the widgets work with.**

## Widgets

- **Live camera**: plays the livestream while the widget is visible and stops it when it is not.
  Shows the last snapshot until the first picture arrives. Pan and tilt controls appear for cameras
  that have them, preset buttons from eusec 3.2.0 on.
- **Event popup**: invisible until one of its triggers turns true (by default `ringing` and
  `person_detected` of the camera, where they exist), then opens the livestream in a dialog and
  closes it after a set time. A trigger that turned true shortly before the view was shown (less
  than the close time ago) still opens it, so a script may switch to the view after the event. It
  opens only on the view it is placed on; place it on every view where it should appear, or in a
  view that all other views include.
- **Snapshot**: the last picture of the camera and its age. A tap opens the livestream.

The dialog of the event popup and the snapshot takes its title, size, colours and font from the
"Dialog" attribute group.

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

### 0.1.0 (2026-10-13)

- (typhosj) Initial version: live player, event popup and snapshot widget

[Older changelog entries](CHANGELOG_OLD.md)

## License

MIT License

Copyright (c) 2026 typhosj <typhosj@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
