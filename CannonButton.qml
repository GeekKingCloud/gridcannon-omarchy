import QtQuick
import qs.Commons
import qs.Ui

BorderSurface {
  id: root
  property string text: ""
  property string detail: ""
  property bool legal: true
  property bool selected: false
  property bool marked: false
  property bool quiet: false
  signal activated()
  implicitWidth: label.implicitWidth + Style.space(18)
  implicitHeight: Style.space(30)
  color: selected || mouse.containsMouse ? Style.hoverFill : "transparent"
  borderSpec: Border.flat(selected || legal ? Color.accent : Color.muted, Style.spacing.hairline)
  opacity: quiet ? 0.55 : 1
  radius: Style.cornerRadius
  Accessible.role: Accessible.Button
  Accessible.name: text + ". " + detail
  Accessible.description: legal ? "Available" : "Unavailable"
  Accessible.onPressAction: if (root.legal) root.activated()
  Column {
    anchors.centerIn: parent
    width: parent.width - Style.space(6)
    spacing: Style.space(2)
    Text {
      id: label
      width: parent.width
      text: (root.selected ? "› " : root.marked ? "• " : "") + root.text
      color: Color.popups.text
      font.family: Style.font.family
      font.pixelSize: Style.font.body
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
    }
    Text {
      width: parent.width
      visible: text !== ""
      text: root.detail
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: Style.font.caption
      horizontalAlignment: Text.AlignHCenter
      elide: Text.ElideRight
    }
  }
  MouseArea {
    id: mouse
    anchors.fill: parent
    hoverEnabled: true
    cursorShape: root.legal ? Qt.PointingHandCursor : Qt.ArrowCursor
    onClicked: if (root.legal) root.activated()
  }
}
