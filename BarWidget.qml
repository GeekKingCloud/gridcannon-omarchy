import QtQuick
import qs.Commons
import qs.Ui
import "engine.mjs" as Engine

Panel {
  id: root
  moduleName: "geekkingcloud.gridcannon"
  ipcTarget: "geekkingcloud.gridcannon"
  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight
  // The session outlives the popup, but not shell reload/plugin removal.
  property var game: Engine.createGame("revised")
  property string tool: ""
  property int source: -1
  property int cursor: 21
  property string notice: ""
  property string confirmation: ""
  property bool helpOpen: false
  property bool confirmYes: false
  onConfirmationChanged: { confirmYes = false; viewport.contentY = 0 }
  onHelpOpenChanged: viewport.contentY = 0
  onCursorChanged: Qt.callLater(revealCursor)
  readonly property var board: [-1,9,10,11,-1,20,0,1,2,12,19,3,4,5,13,18,6,7,8,14,-1,17,16,15,-1]
  readonly property var actions: ["Draw", "Keep deal", "Extract", "Reassign", "Hard reset", "Recycle", "New", "Mode", "Rules", "Cancel"]
  readonly property bool playing: game.status === "playing"

  function send(action) {
    try {
      game = Engine.act(game, action)
      tool = ""; source = -1; notice = ""
      return true
    } catch(e) { notice = e.message; return false }
  }
  function available(id) {
    if (id >= 27 && id <= 29) return true
    if (id === 30) return tool !== ""
    if (!playing) return false
    if (id < 9) {
      if (game.stage === "mulligan") return true
      if (tool === "extract" || tool === "reset" || tool === "refill") return game.grid[id].length > 0
      if (tool === "move") return source < 0 ? game.grid[id].length > 0 : id !== source && Engine.placements(game, Engine.top(game.grid[source])).includes(id)
      return Engine.placements(game).includes(id) && game.stage === "play"
    }
    if (id < 21) return Engine.royal(game.pending) ? Engine.royalSlots(game).includes(id - 9) : Engine.armourSlots(game).includes(id - 9)
    if (id === 21) return game.stage === "play" && !game.pending && game.deck.length > 0
    if (id === 22) return game.stage === "mulligan"
    if (id === 23 || id === 24) return game.mode === "revised" && game.stage === "play" && game.ploys.some(c => c.rank === (id === 23 ? 1 : 0))
    if (id === 25) return game.mode === "classic" && game.stage === "play" && !!game.pending && !Engine.royal(game.pending) && !Engine.placements(game).length
    if (id === 26) return game.mode === "classic" && game.stage === "play" && !game.pending && !game.deck.length
    return false
  }
  function activate(id) {
    if (confirmation || helpOpen || !available(id)) return
    cursor = id
    if (id < 9) {
      if (game.stage === "mulligan") send({type:"replace", index:id})
      else if (tool === "move" && source < 0) { source = id; notice = "Reassign: choose a different legal destination." }
      else send({type:tool || "place", index:id, from:source})
    } else if (id < 21) send({type:Engine.royal(game.pending) ? "royal" : "armour", index:id-9})
    else if (id === 21) send({type:"draw"})
    else if (id === 22) send({type:"keep"})
    else if (id < 27) {
      tool = ["extract","move","reset","refill"][id-23]; source = -1
      notice = tool === "move" ? "Reassign: choose the source stack." : "Choose a stack. Escape cancels."
    } else if (id === 27) confirmation = game.mode
    else if (id === 28) confirmation = game.mode === "revised" ? "classic" : "revised"
    else if (id === 29) helpOpen = true
    else cancelSelection()
  }
  function cancelSelection() { tool = ""; source = -1; notice = "" }
  function confirmNew() {
    game = Engine.createGame(confirmation)
    confirmation = ""; cancelSelection(); cursor = 21
  }
  function dismissLayer() {
    if (confirmation) confirmation = ""
    else if (helpOpen) helpOpen = false
    else if (tool) cancelSelection()
    else close()
  }
  function tab(delta) {
    if (confirmation) { confirmYes = !confirmYes; return }
    if (helpOpen) return
    for (var i = 0; i < 31; i++) {
      cursor = (cursor + delta + 31) % 31
      if (available(cursor)) break
    }
  }
  function move(dx, dy) {
    if (confirmation) { confirmYes = !confirmYes; return }
    if (helpOpen) { viewport.contentY = Math.max(0, Math.min(viewport.contentHeight - viewport.height, viewport.contentY + (dy || dx) * Style.space(40))); return }
    if (cursor >= 21) { tab(dx || dy); return }
    var pos = board.indexOf(cursor), next = pos + dx + dy * 5
    if (next >= 0 && next < 25 && board[next] >= 0 && (!dx || Math.floor(pos/5) === Math.floor(next/5))) cursor = board[next]
  }
  function shortcut(text) {
    if (confirmation) { if (text.toLowerCase() === "y") confirmNew(); return }
    if (helpOpen) return
    if (/^[1-9]$/.test(text)) activate(Number(text)-1)
    else if (text === "d" || text === "D") activate(21)
    else if (text === "n" || text === "N") activate(27)
    else if (text === "?") activate(29)
  }
  function revealCursor() {
    var item = cursor < 21 ? boardRepeater.itemAt(board.indexOf(cursor)) : actionRepeater.itemAt(cursor-21)
    if (!item || !item.visible || confirmation || helpOpen) return
    var y = item.mapToItem(content, 0, 0).y
    if (y < viewport.contentY) viewport.contentY = y
    else if (y + item.height > viewport.contentY + viewport.height) viewport.contentY = y + item.height - viewport.height
  }
  function cardText(id) {
    if (id < 9) return Engine.label(Engine.top(game.grid[id]))
    var royal = game.royals[id-9]
    return royal ? Engine.label(royal.card) + (royal.dead ? " ×" : "") : "·"
  }
  function cardDetail(id) {
    if (id < 9) return (id+1) + " · " + game.grid[id].length + (game.grid[id].length === 1 ? " card" : " cards")
    var r = game.royals[id-9]
    return r ? (r.dead ? "defeated" : Engine.damage(game,id-9) + " / " + (r.card.rank+r.armour) + (r.armour ? " +armour" : "")) : Engine.slotNames[id-9]
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    tooltipText: "Grid Cannon"
    onPressed: function(code) { if (code === Qt.LeftButton) root.toggle() }
    iconComponent: Component {
      Grid {
        columns: 3
        spacing: 2
        Repeater {
          model: 9
          Rectangle {
            required property int index
            width: (button.opticalSize-4)/3
            height: width
            color: "transparent"
            border.width: 1
            border.color: index === 4 ? Color.accent : root.barForeground
          }
        }
      }
    }
  }
  KeyboardPanel {
    id: popup
    anchorItem: button
    owner: root
    bar: root.bar
    open: root.opened
    focusTarget: keys
    contentWidth: fittedContentWidth(Style.space(570))
    contentHeight: fittedContentHeight(content.implicitHeight, Style.space(760))
    PanelKeyCatcher {
      id: keys
      anchors.fill: parent
      onCloseRequested: root.dismissLayer()
      onTabRequested: function(direction) { root.tab(direction) }
      onMoveRequested: function(dx,dy) { root.move(dx,dy) }
      onActivateRequested: {
        if (root.confirmation) { if (root.confirmYes) root.confirmNew(); else root.confirmation = "" }
        else if (root.helpOpen) root.helpOpen = false
        else root.activate(root.cursor)
      }
      onTextKey: function(text) { root.shortcut(text) }
      Flickable {
        id: viewport
        anchors.fill: parent
        contentHeight: content.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        Column {
          id: content
          width: parent.width
          spacing: Style.spacing.lg
          Text {
            width: parent.width
            text: "Grid Cannon  ·  " + (root.game.mode === "revised" ? "Revised v2" : "Classic v1") + "  ·  " + Engine.kills(root.game) + "/12"
            color: Color.popups.text
            font.family: Style.font.family
            font.pixelSize: Style.font.title
            wrapMode: Text.WordWrap
          }
          Column {
            width: parent.width
            visible: root.confirmation !== ""
            spacing: Style.spacing.lg
            Text {
              width: parent.width
              text: "Discard this game and start " + root.confirmation + "?"
              wrapMode: Text.WordWrap
              color: Color.popups.text
              font.family: Style.font.family
              font.pixelSize: Style.font.body
            }
            Row {
              spacing: Style.spacing.lg
              CannonButton { text: "Yes (Y)"; selected: root.confirmYes; onActivated: root.confirmNew() }
              CannonButton { text: "Cancel (Esc)"; selected: !root.confirmYes; onActivated: root.confirmation = "" }
            }
          }
          Text {
            visible: root.helpOpen
            width: parent.width
            wrapMode: Text.WordWrap
            text: "Defeat all twelve royals. Play numbers on equal or lower cards, or empty spaces. A play fires the TWO intervening cards toward the royal at the opposite edge; the new card is the trigger, not payload.\n\nJack: any suit totals 11. Queen: same colour totals 12. King: same suit totals 13. The payload / health appears below each royal. Failed shots do nothing. Royal placement follows suit, colour, then highest neighbour; highlighted ties are your choice.\n\nRevised v2: optionally replace one opening card. Bank aces to extract an entire stack and jokers to reassign its top card (source, then destination). Blocked cards become armour only after all ploys are spent. Armour of 20 health (19 for a king), or exhausting cards and ploys, loses.\n\nClassic v1: aces/jokers reset stacks. A blocked card can become armour or Hard reset a stack, sending the drawn card to shame. Recycle after the deck empties: sacrifice the stack top to shame. Minimize shame.\n\nWhen no living royal remains, cycle to the next. A blocked hand is suspended while deploying that royal, then restored. A twelfth kill wins immediately.\n\nD draws · 1–9 plays grid · arrows/hjkl move cursor · Tab cycles available targets · Enter/Space activates · N new game · ? rules · Escape cancels, then closes.\n\nGridcannon by Tom Francis; armour idea by Chris Thursten. Full source and digital conventions in README."
            color: Color.popups.text
            font.family: Style.font.family
            font.pixelSize: Style.font.body
          }
          CannonButton { visible: root.helpOpen; text: "Back (Esc)"; onActivated: root.helpOpen = false }
          Grid {
            id: boardGrid
            visible: !root.helpOpen && !root.confirmation
            width: parent.width
            columns: 5
            spacing: Style.spacing.sm
            Repeater {
              id: boardRepeater
              model: root.board
              Item {
                required property int modelData
                width: Math.floor((boardGrid.width - boardGrid.spacing * 4) / 5)
                height: Style.space(65)
                CannonButton {
                  anchors.fill: parent
                  objectName: "gridcannon-cell-" + modelData
                  visible: modelData >= 0
                  text: modelData >= 0 ? root.cardText(modelData) : ""
                  detail: modelData >= 0 ? root.cardDetail(modelData) : ""
                  legal: modelData >= 0 && root.available(modelData)
                  selected: root.cursor === modelData
                  marked: root.source === modelData
                  quiet: modelData >= 9 && !!root.game.royals[modelData-9] && root.game.royals[modelData-9].dead
                  onActivated: root.activate(modelData)
                }
              }
            }
          }
          Text {
            visible: !root.helpOpen && !root.confirmation
            width: parent.width
            text: "Hand: " + (root.game.pending ? Engine.label(root.game.pending) : "—") + "   Deck: " + root.game.deck.length + (root.game.mode === "revised" ? "   Aces: " + root.game.ploys.filter(c => c.rank === 1).length + "   Jokers: " + root.game.ploys.filter(c => c.rank === 0).length : "   Shame: " + root.game.shame.length)
            color: Color.popups.text
            font.family: Style.font.family
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }
          Text {
            visible: !root.helpOpen && !root.confirmation
            width: parent.width
            text: root.notice || root.game.message
            color: Color.popups.text
            font.family: Style.font.family
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }
          Flow {
            visible: !root.helpOpen && !root.confirmation
            width: parent.width
            spacing: Style.spacing.sm
            Repeater {
              id: actionRepeater
              model: root.actions
              CannonButton {
                required property int index
                required property string modelData
                text: modelData
                visible: root.available(index + 21) || index === 0
                legal: root.available(index + 21)
                selected: root.cursor === index + 21
                onActivated: root.activate(index + 21)
              }
            }
          }
          Text {
            visible: !root.helpOpen && !root.confirmation
            width: parent.width
            text: "D draw · 1–9 grid · Tab/Enter select · ? rules · Esc close"
            color: Color.muted
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
          }
        }
      }
    }
  }
}
