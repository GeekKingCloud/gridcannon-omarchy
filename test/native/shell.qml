import QtQuick
import QtTest
import Quickshell
import Quickshell.Io
import qs.Commons
import "Plugin" as Plugin
ShellRoot {
  id: host
  TestCase { id: mouseDriver; when: false }
  property var fixtures: ({})
  property string position: "top"
  FileView {
    path: Quickshell.shellDir + "/fixtures.json"
    onLoaded: host.fixtures = JSON.parse(text())
  }
  QtObject {
    id: bar
    property color barForeground: Color.foreground
    property color urgent: Color.urgent
    property string fontFamily: Style.font.family
    property bool foregroundAnimationEnabled: false
    property string position: host.position
    property bool vertical: position === "left" || position === "right"
    property int barSize: Style.bar.sizeHorizontal
    property var activePopout: null
    property var clickTargets: []
    function requestPopout(owner) { activePopout = owner }
    function releasePopout(owner) { if (activePopout === owner) activePopout = null }
    function hideTooltip(owner) {}
    function showTooltip(owner, text) {}
    function registerClickTarget(target) { clickTargets = clickTargets.concat([target]) }
    function unregisterClickTarget(target) { clickTargets = clickTargets.filter(x => x !== target) }
  }
  PanelWindow {
    id: barWindow
    anchors.top: host.position !== "bottom"
    anchors.bottom: host.position !== "top"
    anchors.left: host.position !== "right"
    anchors.right: host.position !== "left"
    implicitHeight: bar.barSize
    implicitWidth: bar.barSize
    color: Color.bar.background
    Plugin.BarWidget {
      id: game
      bar: bar
      anchors.centerIn: parent
      width: implicitWidth
      height: implicitHeight
    }
  }
  IpcHandler {
    target: "test"
    function snapshot(): string {
      return JSON.stringify({game:game.game, opened:game.opened, cursor:game.cursor, tool:game.tool, source:game.source, confirmation:game.confirmation, help:game.helpOpen, notice:game.notice, accent:Color.accent.toString(), foreground:Color.foreground.toString()})
    }
    function action(id: int): void { game.activate(id) }
    function findItem(name: string): var {
      var item = mouseDriver.findChild(game, name)
      // KeyboardPanel.contentItem is an alias to a list, not a QQuickItem.
      for (var i = 0; !item && i < game.resources.length; ++i) {
        var contents = game.resources[i].contentItem
        if (!contents) continue
        for (var j = 0; !item && j < contents.length; ++j)
          item = mouseDriver.findChild(contents[j], name)
      }
      if (!item) throw new Error("Missing native item " + name)
      return item
    }
    function inks(): string {
      var cells = []
      for (var id = 0; id < 21; id++) {
        var card = game.cardAt(id)
        if (card) cells.push({suit:card.suit, ink:findItem("gridcannon-cell-" + id).labelColor.toString()})
      }
      return JSON.stringify({cells:cells, hand:findItem("gridcannon-hand").color.toString(),
        pending:game.game.pending, neutral:Color.popups.text.toString()})
    }
    function click(id: int): void {
      var item = findItem("gridcannon-cell-" + id)
      mouseDriver.mouseClick(item, item.width/2, item.height/2)
    }
    function fixture(name: string): void {
      game.game = JSON.parse(JSON.stringify(host.fixtures[name]))
      game.cancelSelection(); game.confirmation = ""; game.helpOpen = false; game.cursor = 21
    }
    function theme(name: string): void {
      Color.shellValues = ({})
      if (name === "light") {
        Color.background = "#fafafa"; Color.foreground = "#202020"; Color.accent = "#7a267e"; Color.muted = "#656565"
      } else {
        Color.background = "#12171d"; Color.foreground = "#e0e6eb"; Color.accent = name === "mono" ? "#e0e6eb" : "#5de4c7"; Color.muted = "#8a9ba8"
      }
    }
    function orientation(name: string): void { host.position = name }
    function scale(value: int): void { Style.fontBaseSize = value }
  }
}
