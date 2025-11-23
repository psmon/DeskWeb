/**
 * HTML Renderer
 * 파싱된 HWP 데이터를 HTML로 렌더링
 */

class HTMLRenderer {
    constructor() {
        this.output = null;
    }

    /**
     * HWP 문서를 HTML로 렌더링
     * @param {Object} parsedData - HWPParser.parse()의 결과
     * @param {HTMLElement} container - 렌더링할 컨테이너 엘리먼트
     */
    render(parsedData, container) {
        this.output = container;
        this.output.innerHTML = ''; // 초기화

        // 문서 래퍼
        const docDiv = document.createElement('div');
        docDiv.className = 'hwp-document';

        // 헤더 정보 (선택적)
        if (parsedData.header) {
            const headerInfo = this.renderHeaderInfo(parsedData.header);
            docDiv.appendChild(headerInfo);
        }

        // 섹션에서 문단 개수 확인
        let totalParagraphs = 0;
        if (parsedData.sections && parsedData.sections.length > 0) {
            parsedData.sections.forEach(section => {
                totalParagraphs += (section.paragraphs ? section.paragraphs.length : 0);
            });
        }

        // 섹션 렌더링
        if (parsedData.sections && parsedData.sections.length > 0 && totalParagraphs > 0) {
            parsedData.sections.forEach((section, index) => {
                const sectionDiv = this.renderSection(section, index);
                docDiv.appendChild(sectionDiv);
            });
        } else if (parsedData.prvText) {
            // PrvText 대체 렌더링
            const prvTextDiv = this.renderPrvText(parsedData.prvText);
            docDiv.appendChild(prvTextDiv);
        } else {
            const noContent = document.createElement('p');
            noContent.style.color = '#999';
            noContent.style.fontStyle = 'italic';
            noContent.textContent = '렌더링할 콘텐츠가 없습니다.';
            docDiv.appendChild(noContent);
        }

        this.output.appendChild(docDiv);
    }

    /**
     * 헤더 정보 렌더링 (선택적, 접을 수 있게)
     */
    renderHeaderInfo(header) {
        const details = document.createElement('details');
        details.style.marginBottom = '20px';
        details.style.padding = '15px';
        details.style.background = '#f0f0f0';
        details.style.borderRadius = '6px';

        const summary = document.createElement('summary');
        summary.style.cursor = 'pointer';
        summary.style.fontWeight = 'bold';
        summary.style.color = '#333';
        summary.textContent = '문서 정보';
        details.appendChild(summary);

        const info = document.createElement('div');
        info.style.marginTop = '10px';
        info.style.fontSize = '0.9rem';

        const infoItems = [
            { label: '서명', value: header.signature },
            { label: '버전', value: header.version.string },
            { label: '압축 여부', value: header.flags.compressed ? '예' : '아니오' },
            { label: '암호화 여부', value: header.flags.encrypted ? '예' : '아니오' }
        ];

        infoItems.forEach(item => {
            const p = document.createElement('p');
            p.innerHTML = '<strong>' + item.label + ':</strong> ' + this.escapeHtml(item.value);
            p.style.margin = '5px 0';
            info.appendChild(p);
        });

        details.appendChild(info);
        return details;
    }

    /**
     * 섹션 렌더링
     */
    renderSection(section, index) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'hwp-section';
        sectionDiv.style.marginBottom = '30px';

        // 섹션 제목 (디버깅용, 필요시 숨김 가능)
        if (section.paragraphs.length > 0) {
            const sectionTitle = document.createElement('h3');
            sectionTitle.style.color = '#666';
            sectionTitle.style.fontSize = '0.9rem';
            sectionTitle.style.marginBottom = '10px';
            sectionTitle.style.borderBottom = '1px solid #ddd';
            sectionTitle.style.paddingBottom = '5px';
            sectionTitle.textContent = 'Section ' + index + ' (' + section.paragraphs.length + '개 문단)';
            sectionDiv.appendChild(sectionTitle);
        }

        // 문단 렌더링
        section.paragraphs.forEach((para, paraIndex) => {
            const paraDiv = this.renderParagraph(para, paraIndex);
            sectionDiv.appendChild(paraDiv);
        });

        return sectionDiv;
    }

    /**
     * 문단 렌더링
     */
    renderParagraph(paragraph, index) {
        const paraDiv = document.createElement('p');
        paraDiv.className = 'hwp-paragraph';
        paraDiv.style.margin = '0 0 12px 0';
        paraDiv.style.lineHeight = '1.8';
        paraDiv.style.textAlign = 'left';

        // 텍스트 내용
        const text = paragraph.text || '';

        if (text.trim().length > 0) {
            paraDiv.textContent = text;
        } else {
            // 빈 문단 처리 (줄바꿈 유지)
            paraDiv.innerHTML = '&nbsp;';
            paraDiv.style.minHeight = '1.2em';
        }

        return paraDiv;
    }

    /**
     * PrvText 렌더링 (미리보기 텍스트)
     */
    renderPrvText(prvText) {
        const prvTextDiv = document.createElement('div');
        prvTextDiv.className = 'hwp-prvtext';
        prvTextDiv.style.padding = '20px';
        prvTextDiv.style.background = '#fffbf0';
        prvTextDiv.style.borderLeft = '4px solid #ffa500';
        prvTextDiv.style.marginBottom = '20px';

        // 안내 메시지
        const notice = document.createElement('p');
        notice.style.color = '#ff8c00';
        notice.style.fontWeight = 'bold';
        notice.style.marginBottom = '10px';
        notice.textContent = '미리보기 텍스트 (PrvText)';
        prvTextDiv.appendChild(notice);

        const info = document.createElement('p');
        info.style.fontSize = '0.85rem';
        info.style.color = '#666';
        info.style.marginBottom = '15px';
        info.textContent = '복잡한 압축 구조로 인해 원본 문단 파싱에 실패했습니다. 대신 미리보기 텍스트를 표시합니다.';
        prvTextDiv.appendChild(info);

        // 텍스트 내용
        const textContent = document.createElement('div');
        textContent.style.whiteSpace = 'pre-wrap';
        textContent.style.lineHeight = '1.8';
        textContent.style.fontFamily = 'inherit';
        textContent.textContent = prvText;
        prvTextDiv.appendChild(textContent);

        return prvTextDiv;
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 디버그 정보 렌더링
     */
    renderDebugInfo(parsedData, container) {
        let debugText = '=== HWP 파일 파싱 결과 ===\n\n';

        if (parsedData.header) {
            debugText += '[ FileHeader ]\n';
            debugText += '서명: ' + parsedData.header.signature + '\n';
            debugText += '버전: ' + parsedData.header.version.string + '\n';
            debugText += '압축: ' + parsedData.header.flags.compressed + '\n';
            debugText += '암호화: ' + parsedData.header.flags.encrypted + '\n';
            debugText += '플래그: 0x' + parsedData.header.flags.raw.toString(16) + '\n\n';
        }

        if (parsedData.docInfo) {
            debugText += '[ DocInfo ]\n';
            debugText += '레코드 수: ' + parsedData.docInfo.records.length + '\n';
            debugText += '글꼴: ' + (parsedData.docInfo.faceName?.length || 0) + '개\n';
            debugText += '글자 모양: ' + (parsedData.docInfo.charShapes?.length || 0) + '개\n';
            debugText += '문단 모양: ' + (parsedData.docInfo.paraShapes?.length || 0) + '개\n\n';
        }

        if (parsedData.prvText) {
            debugText += '[ PrvText ]\n';
            debugText += '길이: ' + parsedData.prvText.length + '자\n';
            const preview = parsedData.prvText.substring(0, 100).replace(/\n/g, ' ');
            debugText += '미리보기: "' + preview + (parsedData.prvText.length > 100 ? '...' : '') + '"\n\n';
        }

        if (parsedData.sections) {
            debugText += '[ Sections ]\n';
            debugText += '섹션 수: ' + parsedData.sections.length + '\n\n';

            parsedData.sections.forEach((section, i) => {
                debugText += 'Section ' + i + ':\n';
                debugText += '  레코드: ' + section.records.length + '개\n';
                debugText += '  문단: ' + section.paragraphs.length + '개\n';

                // 각 문단의 글자 수
                section.paragraphs.forEach((para, j) => {
                    const charCount = para.text?.length || 0;
                    if (charCount > 0) {
                        const preview = para.text.substring(0, 30).replace(/\n/g, ' ');
                        const ellipsis = charCount > 30 ? '...' : '';
                        debugText += '    P' + j + ': ' + charCount + '자 - "' + preview + ellipsis + '"\n';
                    }
                });
                debugText += '\n';
            });
        }

        debugText += '=== 파싱 완료 ===';
        container.textContent = debugText;
    }
}
