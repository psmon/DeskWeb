import { useState } from "react";
import { api, type AppSettings, type FsListResponse, type SmbShare } from "../api/client";

interface Props {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  hidden?: boolean;
}

const EMPTY_SHARE: SmbShare = {
  name: "",
  host: "",
  share: "",
  path: "",
  username: "",
  password: "",
  domain: "",
};

export default function SettingsView({ settings, onSave, hidden }: Props) {
  const [explorer, setExplorer] = useState<FsListResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<SmbShare>(EMPTY_SHARE);
  const [smbMsg, setSmbMsg] = useState<string | null>(null);

  const addShare = () => {
    if (!form.name || !form.host || !form.share) {
      setSmbMsg("이름 · 호스트 · 공유명은 필수입니다.");
      return;
    }
    if (settings.smbShares.some((s) => s.name === form.name)) {
      setSmbMsg("같은 이름의 공유가 이미 있습니다.");
      return;
    }
    onSave({ ...settings, smbShares: [...settings.smbShares, form] });
    setForm(EMPTY_SHARE);
    setSmbMsg("추가됨");
  };

  const removeShare = (name: string) =>
    onSave({ ...settings, smbShares: settings.smbShares.filter((s) => s.name !== name) });

  const testShare = async () => {
    setSmbMsg("연결 테스트 중…");
    const r = await api.smbTest(form);
    setSmbMsg(r.ok ? "✓ 연결 성공" : "✗ 연결 실패 (호스트/공유/계정/비번 확인)");
  };

  const openExplorer = async (path?: string) => {
    setErr(null);
    try {
      setExplorer(await api.explore(path));
    } catch (e) {
      setErr(String(e));
    }
  };

  const addFolder = (path: string) => {
    if (settings.scanFolders.includes(path)) return;
    onSave({ ...settings, scanFolders: [...settings.scanFolders, path] });
    setExplorer(null);
  };

  const removeFolder = (path: string) =>
    onSave({ ...settings, scanFolders: settings.scanFolders.filter((f) => f !== path) });

  return (
    <div className="settingsview" hidden={hidden}>
      <h2>설정</h2>
      {err && <div className="error">{err}</div>}

      {/* scan folders */}
      <section className="setting-block">
        <h3>스캔 폴더</h3>
        <p className="note">
          접근 허용된 폴더 <b>안에서만</b> 선택됩니다 (상위 폴더는 탐색 불가).
          접근 허용 폴더는: <b>Docker</b> = 컨테이너에 마운트한 경로(`/music` 등),
          <b> UGOS</b> = App Center 앱 설정에서 인가한 NAS 공유/사용자 폴더.
        </p>
        <ul className="folder-list">
          {settings.scanFolders.map((f) => (
            <li key={f}>
              <span className="p">{f}</span>
              <button className="rm" onClick={() => removeFolder(f)}>
                제거
              </button>
            </li>
          ))}
          {!settings.scanFolders.length && <li className="hint">추가된 폴더가 없습니다.</li>}
        </ul>

        {explorer ? (
          <div className="explorer">
            <div className="crumb">{explorer.path || "(최상위)"}</div>
            <ul className="entries">
              {explorer.parent && (
                <li>
                  <button onClick={() => openExplorer(explorer.parent!)}>⬆ ..</button>
                </li>
              )}
              {explorer.entries.map((e) => (
                <li key={e.path}>
                  <button onClick={() => openExplorer(e.path)}>📁 {e.name}</button>
                </li>
              ))}
              {!explorer.entries.length && <li className="hint">하위 폴더 없음</li>}
            </ul>
            <div className="explorer-actions">
              {explorer.path && (
                <button className="add" onClick={() => addFolder(explorer.path)}>
                  ✓ 이 폴더 추가: {explorer.path}
                </button>
              )}
              <button onClick={() => setExplorer(null)}>닫기</button>
            </div>
          </div>
        ) : (
          <button className="browse" onClick={() => openExplorer()}>
            📂 폴더 찾아보기
          </button>
        )}
      </section>

      {/* SMB shares */}
      <section className="setting-block">
        <h3>SMB 공유 (NAS)</h3>
        <p className="note">
          NAS의 SMB 공유를 추가하면 앱이 직접 접속해 재생합니다 (OS 마운트 불필요). 비밀번호는 저장 후 표시되지 않습니다.
        </p>
        <ul className="folder-list">
          {settings.smbShares.map((s) => (
            <li key={s.name}>
              <span className="p">
                {s.name} — \\{s.host}\{s.share}
                {s.path ? "\\" + s.path : ""} ({s.username})
              </span>
              <button className="rm" onClick={() => removeShare(s.name)}>
                제거
              </button>
            </li>
          ))}
          {!settings.smbShares.length && <li className="hint">추가된 SMB 공유가 없습니다.</li>}
        </ul>
        <div className="smb-form">
          <input placeholder="이름 (고유)" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="호스트 (예: 192.168.x.x)" value={form.host}
            onChange={(e) => setForm({ ...form, host: e.target.value })} />
          <input placeholder="공유명 (예: MEDIA)" value={form.share}
            onChange={(e) => setForm({ ...form, share: e.target.value })} />
          <input placeholder="하위 경로 (예: music · 선택)" value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })} />
          <input placeholder="사용자" value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <input type="password" placeholder="비밀번호" value={form.password ?? ""}
            onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="smb-actions">
          <button onClick={testShare}>연결 테스트</button>
          <button className="add" onClick={addShare}>추가</button>
          {smbMsg && <span className="smb-msg">{smbMsg}</span>}
        </div>
      </section>

      {/* preferences */}
      <section className="setting-block">
        <h3>재생 설정</h3>
        <label className="row">
          <span>기본 엔진</span>
          <select
            value={settings.defaultEngine}
            onChange={(e) => onSave({ ...settings, defaultEngine: e.target.value })}
          >
            <option value="real">Real 악기 HQ (SpessaSynth)</option>
            <option value="simple">일반 MIDI (html-midi-player)</option>
          </select>
        </label>
        <label className="row">
          <span>볼륨</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(e) => onSave({ ...settings, volume: Number(e.target.value) })}
          />
        </label>
        <label className="row">
          <span>BitMidi 온라인 검색</span>
          <input
            type="checkbox"
            checked={settings.bitmidiEnabled}
            onChange={(e) => onSave({ ...settings, bitmidiEnabled: e.target.checked })}
          />
        </label>
      </section>
    </div>
  );
}
