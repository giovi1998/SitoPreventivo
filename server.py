import http.server
import socketserver

PORT = 8000

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        super().end_headers()

# Add MIME mapping for JSX files
CustomHTTPRequestHandler.extensions_map.update({
    '.jsx': 'application/javascript',
    '.js': 'application/javascript',
})

with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
    print(f"Serving HTTP on port {PORT} with .jsx support...")
    httpd.serve_forever()
