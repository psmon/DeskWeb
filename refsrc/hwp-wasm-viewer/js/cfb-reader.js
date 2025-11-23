/**
 * CFB (Compound File Binary) Reader
 * HWP 파일의 복합 파일 구조를 읽기 위한 래퍼 클래스
 */

class CFBReader {
    constructor(arrayBuffer) {
        try {
            // CFB 라이브러리 확인
            if (typeof CFB === 'undefined') {
                throw new Error('CFB 라이브러리가 로드되지 않았습니다');
            }

            // ArrayBuffer를 Uint8Array로 변환
            const data = new Uint8Array(arrayBuffer);

            // CFB 라이브러리를 사용하여 파일 파싱
            this.cfb = CFB.read(data, { type: 'array' });
            this.entries = this.cfb.FileIndex;
        } catch (error) {
            console.error('CFB 파싱 상세 오류:', error);
            throw new Error('CFB 파일 파싱 실패: ' + error.message);
        }
    }

    /**
     * 스트림 목록 가져오기
     */
    listStreams() {
        return this.entries
            .filter(entry => entry.type === 2) // 2 = Stream
            .map(entry => entry.name);
    }

    /**
     * 스토리지 목록 가져오기
     */
    listStorages() {
        return this.entries
            .filter(entry => entry.type === 1) // 1 = Storage
            .map(entry => entry.name);
    }

    /**
     * 특정 스트림 읽기
     * @param {string} streamName - 스트림 이름 (예: "FileHeader", "BodyText/Section0")
     * @returns {Uint8Array|null} 스트림 데이터
     */
    readStream(streamName) {
        try {
            let data;

            // CFB.find 시도 (문자열만 - 배열은 charCodeAt 오류 발생)
            try {
                data = CFB.find(this.cfb, streamName);
            } catch (e) {
                // CFB.find 실패 시 무시
            }

            // 실패하면 FileIndex에서 직접 검색
            if (!data) {
                const pathParts = streamName.split('/').filter(p => p);

                data = this.cfb.FileIndex.find(entry => {
                    if (!entry.name) return false;

                    // 정확히 일치
                    if (entry.name === streamName) return true;

                    // '/' 로 시작하는 경로 비교
                    if ('/' + streamName === entry.name) return true;
                    if (streamName === '/' + entry.name) return true;

                    // 경로 부분 비교 (ViewText/Section0 vs Section0)
                    const entryParts = entry.name.split('/').filter(p => p);

                    // 완전 일치
                    if (entryParts.length === pathParts.length) {
                        return entryParts.every((part, idx) => part === pathParts[idx]);
                    }

                    // 부분 일치 (마지막 부분만 - Section0 등)
                    if (pathParts.length > 0 && entryParts.length > 0) {
                        return entryParts[entryParts.length - 1] === pathParts[pathParts.length - 1];
                    }

                    return false;
                });
            }

            if (!data) {
                return null;
            }

            // content를 Uint8Array로 변환
            return new Uint8Array(data.content);
        } catch (error) {
            console.error(`스트림 읽기 실패 (${streamName}):`, error);
            return null;
        }
    }

    /**
     * 섹션 스트림 읽기 (BodyText/Section0, ViewText/Section0, Section0 순서로 시도)
     * @param {number} sectionIndex - 섹션 번호
     * @returns {Uint8Array|null}
     */
    readSection(sectionIndex) {
        // 1. BodyText 스토리지 내부에서 찾기
        let data = this.readStream(`BodyText/Section${sectionIndex}`);

        // 2. ViewText 스토리지에서 찾기
        if (!data) {
            data = this.readStream(`ViewText/Section${sectionIndex}`);
        }

        // 3. 루트에서 직접 찾기
        if (!data) {
            data = this.readStream(`Section${sectionIndex}`);
        }

        return data;
    }

    /**
     * 바이너리 데이터 읽기 (BinData/BIN000X.*)
     * @param {number} binId - 바이너리 ID
     * @returns {Uint8Array|null}
     */
    readBinaryData(binId) {
        const binName = `BIN${String(binId).padStart(4, '0')}`;
        // BinData 스토리지 내에서 해당 ID를 가진 스트림 찾기
        const streams = this.listStreams();
        const matchingStream = streams.find(name => name.includes(binName));

        if (matchingStream) {
            return this.readStream(matchingStream);
        }
        return null;
    }

    /**
     * 디버그: 파일 구조 출력
     */
    debugPrintStructure() {
        console.log('=== CFB File Structure ===');
        console.log('Storages:');
        this.listStorages().forEach(name => console.log(`  📁 ${name}`));
        console.log('\nStreams:');
        this.listStreams().forEach(name => console.log(`  📄 ${name}`));

        // 디버그: 모든 엔트리의 실제 경로 출력
        console.log('\n=== All FileIndex Entries (Debug) ===');
        this.entries.forEach((entry, idx) => {
            if (entry.name && entry.name.includes('Section')) {
                console.log(`[${idx}] ${entry.name} (type=${entry.type})`);
            }
        });
    }

    /**
     * 파일 정보 가져오기
     */
    getFileInfo() {
        return {
            storageCount: this.listStorages().length,
            streamCount: this.listStreams().length,
            storages: this.listStorages(),
            streams: this.listStreams()
        };
    }
}
