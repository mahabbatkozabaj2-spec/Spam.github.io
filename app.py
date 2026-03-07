import os
import re
import sys

# Принудительно UTF-8 для вывода в консоль (Windows)
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from analyzer import analyze_text, analyze_url, analyze_message

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ── Главная страница ──────────────────────────────────────────────────────────

@app.route('/')
def index():
    return send_file(os.path.join(BASE_DIR, 'index.html'))

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(BASE_DIR, filename)

# ── API: анализ URL ───────────────────────────────────────────────────────────

@app.route('/api/analyze/url', methods=['POST'])
def api_analyze_url():
    data = request.get_json(silent=True) or {}
    url  = data.get('url', '').strip()
    if not url:
        return jsonify({'error': 'URL ne ukazan'}), 400
    result = analyze_url(url)
    return jsonify(result)

# ── API: анализ сообщения ─────────────────────────────────────────────────────

@app.route('/api/analyze/message', methods=['POST'])
def api_analyze_message():
    data    = request.get_json(silent=True) or {}
    message = data.get('message', '').strip()
    if not message:
        return jsonify({'error': 'Soobschenie ne ukazano'}), 400
    result = analyze_message(message)
    return jsonify(result)

# ── API: анализ документа ─────────────────────────────────────────────────────

@app.route('/api/analyze/document', methods=['POST'])
def api_analyze_document():
    if 'file' not in request.files:
        return jsonify({'error': 'Fail ne zagruzhen'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': 'Fail ne vybran'}), 400

    allowed = {'.txt', '.pdf', '.doc', '.docx', '.eml', '.html', '.htm', '.csv', '.log'}
    ext     = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed:
        return jsonify({'error': f'Format ne podderzhivaetsya: {ext}'}), 400

    try:
        raw = file.read()
        content = ''
        for enc in ('utf-8', 'cp1251', 'latin-1'):
            try:
                content = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if not content:
            content = raw.decode('latin-1', errors='replace')
    except Exception as e:
        return jsonify({'error': f'Oshibka chteniya fayla: {str(e)}'}), 400

    if ext in ('.html', '.htm'):
        content = re.sub(r'<[^>]+>', ' ', content)

    if not content.strip():
        return jsonify({'error': 'Fail pustoy'}), 400

    result = analyze_text(content, filename=file.filename)
    return jsonify(result)

# ── Запуск ────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    port = 8000
    print(f'SpamGuard server starting on port {port}...')
    print(f'Open in browser: http://localhost:{port}')
    app.run(
        host='0.0.0.0',
        port=port,
        debug=False,
        use_reloader=False,
        threaded=True,
    )
