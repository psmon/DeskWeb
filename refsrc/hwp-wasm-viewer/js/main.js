/**
 * Main Application
 * HWP Viewer 메인 애플리케이션 로직
 */

(function() {
    'use strict';

    // DOM 요소
    const fileInput = document.getElementById('hwp-file');
    const fileInfo = document.getElementById('file-info');
    const debugOutput = document.getElementById('debug-output');
    const renderOutput = document.getElementById('render-output');

    // 렌더러 인스턴스
    const renderer = new HTMLRenderer();

    /**
     * 파일 선택 이벤트 핸들러
     */
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        console.log('선택된 파일:', file.name);

        // 파일 정보 표시
        showFileInfo(file);

        // 초기화
        debugOutput.textContent = '파일을 읽는 중...';
        renderOutput.innerHTML = '<p style="color: #999;">파싱 중...</p>';

        try {
            // 파일 읽기
            const arrayBuffer = await readFileAsArrayBuffer(file);
            console.log('파일 읽기 완료:', arrayBuffer.byteLength, 'bytes');

            // HWP 파싱 및 렌더링
            await parseAndRender(arrayBuffer);

        } catch (error) {
            console.error('오류 발생:', error);
            showError(error);
        }
    });

    /**
     * 파일을 ArrayBuffer로 읽기
     */
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('파일 읽기 실패'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * HWP 파싱 및 렌더링
     */
    async function parseAndRender(arrayBuffer) {
        try {
            // 1. CFB Reader 생성
            debugOutput.textContent = 'CFB 파일 구조 파싱 중...';
            const cfbReader = new CFBReader(arrayBuffer);
            cfbReader.debugPrintStructure();

            // 2. HWP Parser 생성 및 파싱
            debugOutput.textContent = 'HWP 문서 파싱 중...';
            const parser = new HWPParser(cfbReader);
            const parsedData = await parser.parse();

            console.log('파싱 완료:', parsedData);

            // 3. 디버그 정보 출력
            renderer.renderDebugInfo(parsedData, debugOutput);

            // 4. HTML 렌더링
            renderer.render(parsedData, renderOutput);

            // 성공 메시지
            showSuccess('HWP 파일이 성공적으로 파싱되었습니다!');

        } catch (error) {
            throw error;
        }
    }

    /**
     * 파일 정보 표시
     */
    function showFileInfo(file) {
        fileInfo.classList.remove('hidden');
        fileInfo.innerHTML = `
            <h3>📄 파일 정보</h3>
            <p><strong>파일명:</strong> ${escapeHtml(file.name)}</p>
            <p><strong>크기:</strong> ${formatFileSize(file.size)}</p>
            <p><strong>타입:</strong> ${escapeHtml(file.type || 'application/x-hwp')}</p>
            <p><strong>마지막 수정:</strong> ${new Date(file.lastModified).toLocaleString('ko-KR')}</p>
        `;
    }

    /**
     * 오류 메시지 표시
     */
    function showError(error) {
        renderOutput.innerHTML = `
            <div class="error">
                <h3>❌ 오류 발생</h3>
                <p><strong>메시지:</strong> ${escapeHtml(error.message)}</p>
                <p><strong>스택:</strong></p>
                <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto;">${escapeHtml(error.stack || '')}</pre>
            </div>
        `;

        debugOutput.textContent = `오류: ${error.message}\n\n${error.stack || ''}`;
    }

    /**
     * 성공 메시지 표시
     */
    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.innerHTML = `
            <strong>✅ ${escapeHtml(message)}</strong>
        `;

        // 파일 정보 다음에 삽입
        if (fileInfo.nextSibling) {
            fileInfo.parentNode.insertBefore(successDiv, fileInfo.nextSibling);
        } else {
            fileInfo.parentNode.appendChild(successDiv);
        }

        // 3초 후 제거
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    /**
     * 파일 크기 포맷팅
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    /**
     * HTML 이스케이프
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 드래그 앤 드롭 지원
     */
    const container = document.querySelector('.file-input-container');

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        container.style.background = '#e3f2fd';
    });

    container.addEventListener('dragleave', (e) => {
        e.preventDefault();
        container.style.background = '';
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        container.style.background = '';

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            fileInput.dispatchEvent(new Event('change'));
        }
    });

    /**
     * 초기화
     */
    console.log('HWP WebAssembly Viewer 초기화 완료');
    console.log('버전: 1.0.0');
    console.log('지원: HWP 5.0 파일 형식');

    // 라이브러리 체크
    if (typeof CFB === 'undefined') {
        console.error('CFB 라이브러리가 로드되지 않았습니다');
        showError(new Error('필수 라이브러리(CFB)가 로드되지 않았습니다. 인터넷 연결을 확인하세요.'));
    }

    if (typeof pako === 'undefined') {
        console.error('pako 라이브러리가 로드되지 않았습니다');
        showError(new Error('필수 라이브러리(pako)가 로드되지 않았습니다. 인터넷 연결을 확인하세요.'));
    }

})();
