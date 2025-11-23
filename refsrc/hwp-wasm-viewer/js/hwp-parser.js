/**
 * HWP Parser
 * HWP 5.0 파일 형식을 파싱하는 클래스
 */

class HWPParser {
    constructor(cfbReader) {
        this.cfb = cfbReader;
        this.fileHeader = null;
        this.docInfo = null;
        this.sections = [];
    }

    /**
     * HWP 파일 파싱
     */
    async parse() {
        console.log('HWP 파일 파싱 시작...');

        // 1. FileHeader 파싱
        this.fileHeader = this.parseFileHeader();
        if (!this.fileHeader) {
            throw new Error('FileHeader 파싱 실패');
        }

        console.log('FileHeader 파싱 완료:', this.fileHeader);

        // 2. PrvText 파싱 (미리보기 텍스트 - 간단한 대안)
        const prvText = this.parsePrvText();
        if (prvText) {
            console.log('PrvText 파싱 완료:', prvText.length, '글자');
        }

        // 3. DocInfo 파싱
        this.docInfo = this.parseDocInfo();
        console.log('DocInfo 파싱 완료');

        // 4. BodyText 섹션 파싱
        this.parseSections();
        console.log(`총 ${this.sections.length}개 섹션 파싱 완료`);

        return {
            header: this.fileHeader,
            docInfo: this.docInfo,
            sections: this.sections,
            prvText: prvText  // 미리보기 텍스트 추가
        };
    }

    /**
     * FileHeader 파싱 (256바이트 고정)
     */
    parseFileHeader() {
        const data = this.cfb.readStream('FileHeader');
        if (!data || data.length < 256) {
            throw new Error('FileHeader 스트림이 유효하지 않습니다');
        }

        const view = new DataView(data.buffer);
        let offset = 0;

        // Signature (32 bytes)
        const signature = new TextDecoder('utf-8').decode(data.slice(0, 32)).replace(/\0/g, '');
        offset += 32;

        // Version (4 bytes) - 0xMMnnPPrr
        const version = view.getUint32(offset, true);
        offset += 4;

        // 속성 (4 bytes)
        const flags = view.getUint32(offset, true);
        offset += 4;

        // 추가 속성 (4 bytes)
        const flags2 = view.getUint32(offset, true);
        offset += 4;

        // EncryptVersion (4 bytes)
        const encryptVersion = view.getUint32(offset, true);
        offset += 4;

        // KOGL 라이선스 국가 (1 byte)
        const koglLicense = view.getUint8(offset);
        offset += 1;

        return {
            signature,
            version: {
                raw: version,
                major: (version >> 24) & 0xFF,
                minor: (version >> 16) & 0xFF,
                patch: (version >> 8) & 0xFF,
                revision: version & 0xFF,
                string: `${(version >> 24) & 0xFF}.${(version >> 16) & 0xFF}.${(version >> 8) & 0xFF}.${version & 0xFF}`
            },
            flags: {
                compressed: !!(flags & 0x01),
                encrypted: !!(flags & 0x02),
                distribution: !!(flags & 0x04),
                script: !!(flags & 0x08),
                drm: !!(flags & 0x10),
                xmlTemplate: !!(flags & 0x20),
                history: !!(flags & 0x40),
                signature: !!(flags & 0x80),
                certificate: !!(flags & 0x100),
                raw: flags
            },
            encryptVersion,
            koglLicense
        };
    }

    /**
     * DocInfo 파싱
     */
    parseDocInfo() {
        let data = this.cfb.readStream('DocInfo');
        if (!data) {
            console.warn('DocInfo 스트림을 찾을 수 없습니다');
            return null;
        }

        // 레코드 구조 파싱 (압축은 레코드 단위로 처리)
        const records = this.parseRecords(data, this.fileHeader.flags.compressed);
        console.log(`DocInfo에서 ${records.length}개 레코드 파싱`);

        return {
            records: records,
            documentProperties: records.find(r => r.tagId === 0x10), // HWPTAG_DOCUMENT_PROPERTIES
            faceName: records.filter(r => r.tagId === 0x13), // HWPTAG_FACE_NAME
            charShapes: records.filter(r => r.tagId === 0x15), // HWPTAG_CHAR_SHAPE
            paraShapes: records.filter(r => r.tagId === 0x19)  // HWPTAG_PARA_SHAPE
        };
    }

    /**
     * 섹션 파싱
     */
    parseSections() {
        const sectionCount = 10; // 최대 10개 섹션 시도

        for (let i = 0; i < sectionCount; i++) {
            let data = this.cfb.readSection(i);
            if (!data) {
                if (i === 0) {
                    console.error('Section0을 찾을 수 없습니다');
                }
                break;
            }

            console.log(`Section${i} 원본 크기: ${data.length} bytes`);

            // ViewText 섹션 감지 (첫 4바이트 확인)
            // ViewText는 일반적으로 0x1c로 시작하고 비압축
            const firstByte = data[0];
            const isViewText = firstByte === 0x1c;

            // 압축 여부 결정
            // ViewText는 비압축, BodyText는 FileHeader 플래그 따름
            let isCompressed = false;
            if (!isViewText && this.fileHeader) {
                isCompressed = this.fileHeader.flags.compressed;
            }

            if (isViewText) {
                console.log(`  → ViewText 섹션 감지 (비압축)`);
            }

            // 레코드 파싱 (스트림 전체 압축 해제 후 파싱)
            const records = this.parseRecords(data, isCompressed);
            const paragraphs = this.extractParagraphs(records);

            this.sections.push({
                index: i,
                records: records,
                paragraphs: paragraphs,
                isViewText: isViewText
            });

            // 레코드 타입별 통계
            const tagCounts = {};
            records.forEach(record => {
                const tagName = this.getTagName(record.tagId);
                tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
            });

            console.log(`Section${i}: ${records.length}개 레코드, ${paragraphs.length}개 문단`);
            if (records.length > 0) {
                console.log('  레코드 타입:', Object.keys(tagCounts).slice(0, 5).join(', ') + (Object.keys(tagCounts).length > 5 ? '...' : ''));
            }
        }
    }

    /**
     * 레코드 구조 파싱
     * 핵심: 먼저 스트림 전체를 압축 해제한 후 레코드 파싱
     */
    parseRecords(data, isCompressed = false) {
        // Step 1: 스트림 전체 압축 해제 (레코드 단위 X)
        if (isCompressed && data.length > 0) {
            try {
                const decompressed = this.decompressStream(data);
                console.log(`스트림 압축 해제 성공: ${data.length} -> ${decompressed.length} bytes`);
                data = decompressed;
            } catch (e) {
                console.warn('스트림 압축 해제 실패, 원본 사용:', e.message);
            }
        }

        // Step 2: 압축 해제된 데이터에서 레코드 파싱
        const records = [];
        let offset = 0;
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        while (offset < data.length - 4) {
            try {
                // 레코드 헤더 (4 bytes)
                const header = view.getUint32(offset, true);
                offset += 4;

                const tagId = header & 0x3FF;           // 10 bits
                const level = (header >> 10) & 0x3FF;   // 10 bits
                let size = (header >> 20) & 0xFFF;      // 12 bits

                // Size가 0xFFF인 경우 다음 4바이트에서 실제 크기 읽기
                if (size === 0xFFF) {
                    if (offset + 4 > data.length) {
                        console.warn('확장 크기 필드를 읽을 수 없음');
                        break;
                    }
                    size = view.getUint32(offset, true);
                    offset += 4;
                }

                // 데이터가 남아있는지 확인
                if (offset + size > data.length) {
                    console.warn(`레코드 크기가 데이터 범위를 초과: tagId=0x${tagId.toString(16)}, offset=${offset}, size=${size}, length=${data.length}`);
                    break;
                }

                // 레코드 데이터 읽기 (이미 압축 해제됨)
                const recordData = data.slice(offset, offset + size);
                offset += size;

                records.push({
                    tagId,
                    level,
                    size,
                    data: recordData
                });
            } catch (error) {
                console.error('레코드 파싱 오류:', error);
                break;
            }
        }

        return records;
    }

    /**
     * 문단 추출
     */
    extractParagraphs(records) {
        const paragraphs = [];

        for (let i = 0; i < records.length; i++) {
            const record = records[i];

            // HWPTAG_PARA_HEADER (0x50 = 80)
            if (record.tagId === 0x50) {
                const paraHeader = this.parseParaHeader(record.data);

                // 다음 레코드에서 텍스트 찾기
                let text = '';
                if (i + 1 < records.length && records[i + 1].tagId === 0x51) { // HWPTAG_PARA_TEXT
                    text = this.parseParaText(records[i + 1].data);
                }

                paragraphs.push({
                    header: paraHeader,
                    text: text
                });
            }
            // PARA_TEXT 단독 (PARA_HEADER 없이)
            else if (record.tagId === 0x51) {
                const text = this.parseParaText(record.data);
                if (text.trim().length > 0) {
                    paragraphs.push({
                        header: null,
                        text: text
                    });
                }
            }
            // ViewText 등에서 다른 태그로 저장된 텍스트 시도
            else if (record.data.length >= 2) {
                // UTF-16LE 텍스트인지 휴리스틱 체크
                const possibleText = this.tryParseText(record.data);
                if (possibleText && possibleText.trim().length > 10) {
                    // 10자 이상의 유효한 텍스트만
                    paragraphs.push({
                        header: null,
                        text: possibleText,
                        tagId: record.tagId  // 디버그용
                    });
                }
            }
        }

        return paragraphs;
    }

    /**
     * UTF-16LE 텍스트 파싱 시도 (휴리스틱)
     */
    tryParseText(data, minLength = 10) {
        if (data.length < 2) return null;

        try {
            const text = new TextDecoder('utf-16le').decode(data);

            // 유효한 텍스트인지 검증
            // - 대부분 인쇄 가능한 문자
            // - 너무 많은 제어 문자 없음
            let printableCount = 0;
            let totalCount = 0;

            for (let i = 0; i < Math.min(text.length, 100); i++) {
                const code = text.charCodeAt(i);
                totalCount++;
                if ((code >= 32 && code <= 126) || // ASCII 인쇄 가능
                    (code >= 0xAC00 && code <= 0xD7A3) || // 한글
                    code === 10 || code === 13 || code === 9) { // 개행, 탭
                    printableCount++;
                }
            }

            const ratio = printableCount / totalCount;

            // 60% 이상이 인쇄 가능한 문자면 텍스트로 간주
            if (ratio >= 0.6) {
                // 제어 문자 필터링
                const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

                // 디버그: 텍스트 발견 시 로그
                if (cleaned.trim().length >= minLength) {
                    console.log(`  💡 텍스트 발견 (ratio=${(ratio*100).toFixed(0)}%): "${cleaned.substring(0, 60)}..."`);
                    return cleaned;
                }
            }
        } catch (e) {
            // 디코딩 실패
        }

        return null;
    }

    /**
     * 문단 헤더 파싱
     */
    parseParaHeader(data) {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

        return {
            nChars: view.getUint32(0, true) & 0x7FFFFFFF,
            controlMask: view.getUint32(4, true),
            paraShapeId: view.getUint16(8, true),
            styleId: view.getUint8(10),
            breakType: view.getUint8(11)
        };
    }

    /**
     * 문단 텍스트 파싱
     */
    parseParaText(data) {
        // UTF-16LE 디코딩
        const text = new TextDecoder('utf-16le').decode(data);

        // 제어 문자 필터링 (0-31 범위의 특수 문자)
        return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    }

    /**
     * 스트림 압축 해제 (zlib/deflate)
     */
    decompressStream(compressedData) {
        try {
            // pako 라이브러리 사용
            // HWP는 raw deflate를 사용할 수 있으므로 inflateRaw 시도
            try {
                return pako.inflateRaw(compressedData);
            } catch (e1) {
                // raw deflate 실패 시 일반 inflate 시도
                try {
                    return pako.inflate(compressedData);
                } catch (e2) {
                    // 둘 다 실패하면 원본 반환
                    throw e2;
                }
            }
        } catch (error) {
            // 압축 해제 실패 시 에러 던지기
            throw error;
        }
    }

    /**
     * PrvText 파싱 (미리보기 텍스트)
     * 압축되지 않은 간단한 텍스트 추출
     */
    parsePrvText() {
        try {
            const data = this.cfb.readStream('PrvText');
            if (!data || data.length === 0) {
                console.warn('PrvText 스트림을 찾을 수 없습니다');
                return null;
            }

            // UTF-16LE 디코딩
            const text = new TextDecoder('utf-16le').decode(data);

            // 제어 문자 필터링
            const cleanedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

            return cleanedText;
        } catch (error) {
            console.error('PrvText 파싱 오류:', error);
            return null;
        }
    }

    /**
     * 태그 ID를 이름으로 변환 (디버깅용)
     */
    getTagName(tagId) {
        const tags = {
            0x10: 'DOCUMENT_PROPERTIES',
            0x11: 'ID_MAPPINGS',
            0x12: 'BIN_DATA',
            0x13: 'FACE_NAME',
            0x14: 'BORDER_FILL',
            0x15: 'CHAR_SHAPE',
            0x16: 'TAB_DEF',
            0x17: 'NUMBERING',
            0x18: 'BULLET',
            0x19: 'PARA_SHAPE',
            0x1A: 'STYLE',
            0x50: 'PARA_HEADER',
            0x51: 'PARA_TEXT',
            0x52: 'PARA_CHAR_SHAPE',
            0x53: 'PARA_LINE_SEG',
            0x54: 'PARA_RANGE_TAG',
            0x55: 'CTRL_HEADER',
            0x56: 'LIST_HEADER',
            0x57: 'PAGE_DEF',
            0x58: 'FOOTNOTE_SHAPE',
            0x59: 'PAGE_BORDER_FILL',
            0x5A: 'SHAPE_COMPONENT',
            0x5B: 'TABLE'
        };
        return tags[tagId] || `UNKNOWN(0x${tagId.toString(16)})`;
    }
}
