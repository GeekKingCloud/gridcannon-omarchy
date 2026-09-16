import QtQuick
import Quickshell
import Quickshell.Io
import "engine.mjs" as Engine
ShellRoot {
  FileView {
    path: Quickshell.shellDir + "/traces.json"
    onLoaded: {
      try {
        var rows = JSON.parse(text())
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i], result = null, error = null
          try { result = Engine[row.name].apply(null, row.args); if (result === undefined) result = null }
          catch(e) { error = e.message }
          if ((row.error || null) !== error || (!error && JSON.stringify(result) !== JSON.stringify(row.result)))
            throw new Error("trace " + i + " " + row.name + ": " + (error || "result differs"))
        }
        console.log("QT_PASS " + rows.length + " parity calls")
      } catch(e) { console.log("QT_FAIL " + e.message) }
    }
    onLoadFailed: console.log("QT_FAIL missing traces")
  }
}
