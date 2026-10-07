import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system/legacy'
import { INSFORGE_API_KEY, INSFORGE_BASE_URL } from '@/lib/insforge'
import { colors } from '@/lib/theme'

const PDFJS_API = require('../../assets/pdfjs/pdf.min.pdfjs')
const PDFJS_WORKER = require('../../assets/pdfjs/pdf.worker.min.pdfjs')

function buildHtml(pdfBase64: string, apiBase64: string, workerBase64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  html, body { margin: 0; padding: 0; background: #334155; }
  canvas { display: block; margin: 8px auto; max-width: 96%; box-shadow: 0 1px 5px rgba(0,0,0,.45); }
  #status { color: #e2e8f0; font-family: -apple-system, Roboto, sans-serif; font-size: 14px; padding: 16px; }
</style>
</head>
<body>
<div id="status">Cargando PDF…</div>
<script>
  (function () {
    var status = document.getElementById("status");
    try {
      eval(atob("${apiBase64}"));

      var wb = atob("${workerBase64}");
      var wbytes = new Uint8Array(wb.length);
      for (var i = 0; i < wb.length; i++) wbytes[i] = wb.charCodeAt(i);
      var workerUrl = URL.createObjectURL(new Blob([wbytes], { type: "application/javascript" }));
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

      var raw = atob("${pdfBase64}");
      var bytes = new Uint8Array(raw.length);
      for (var j = 0; j < raw.length; j++) bytes[j] = raw.charCodeAt(j);

      pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
        status.style.display = "none";
        var pageNum = 1;
        function renderPage() {
          if (pageNum > pdf.numPages) return;
          pdf.getPage(pageNum).then(function (page) {
            var scale = (window.devicePixelRatio || 1) * 1.5;
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            document.body.appendChild(canvas);
            page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise.then(function () {
              pageNum++;
              renderPage();
            });
          });
        }
        renderPage();
      }).catch(function (e) {
        status.textContent = "Error al abrir el PDF: " + e.message;
      });
    } catch (e) {
      status.textContent = "Error: " + e.message;
    }
  })();
</script>
</body>
</html>`
}

export default function PdfViewerScreen() {
  const params = useLocalSearchParams<{ bucket: string; key: string; title?: string }>()
  const bucket = params.bucket
  const key = params.key
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [apiAsset, workerAsset] = await Promise.all([
          Asset.fromModule(PDFJS_API).downloadAsync(),
          Asset.fromModule(PDFJS_WORKER).downloadAsync(),
        ])
        const apiUri = apiAsset.localUri ?? apiAsset.uri
        const workerUri = workerAsset.localUri ?? workerAsset.uri

        const name = (key.split('/').pop() || 'documento.pdf').replace(/[^\w.\-]+/g, '_')
        const dest = `${FileSystem.cacheDirectory}${name}`
        const url = `${INSFORGE_BASE_URL}/api/storage/buckets/${bucket}/objects/${encodeURIComponent(key)}`
        const res = await FileSystem.downloadAsync(url, dest, {
          headers: { Authorization: `Bearer ${INSFORGE_API_KEY}` },
        })
        if (res.status !== 200) throw new Error(`No se pudo descargar (HTTP ${res.status})`)

        const [pdfB64, apiB64, workerB64] = await Promise.all([
          FileSystem.readAsStringAsync(res.uri, { encoding: FileSystem.EncodingType.Base64 }),
          FileSystem.readAsStringAsync(apiUri, { encoding: FileSystem.EncodingType.Base64 }),
          FileSystem.readAsStringAsync(workerUri, { encoding: FileSystem.EncodingType.Base64 }),
        ])
        if (active) setHtml(buildHtml(pdfB64, apiB64, workerB64))
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Error al abrir el PDF')
      }
    })()
    return () => {
      active = false
    }
  }, [bucket, key])

  return (
    <>
      <Stack.Screen options={{ title: params.title ?? 'PDF' }} />
      <View style={{ flex: 1, backgroundColor: '#334155' }}>
        {error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#fff', textAlign: 'center' }}>{error}</Text>
          </View>
        ) : html ? (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
            style={{ flex: 1, backgroundColor: '#334155' }}
            renderLoading={() => (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={colors.emerald} />
              </View>
            )}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={colors.emerald} />
          </View>
        )}
      </View>
    </>
  )
}
