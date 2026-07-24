/**
 * MobileHome - 모바일(iOS 스타일) 홈 스크린
 *
 * 모바일 사이즈 뷰포트에서 XP 데스크톱 대신 표시되는 스프링보드.
 * 상단 상태바(시계), 앱 아이콘 그리드, 하단 독(Dock)으로 구성.
 * 아이콘 탭 시 "launch" 이벤트(앱 id)를 발생시킨다.
 */
qx.Class.define("deskweb.ui.MobileHome", {
  extend: qx.ui.container.Composite,

  events: {
    /** 앱 실행 요청 (data: 앱 id) */
    "launch": "qx.event.type.Data"
  },

  /**
   * @param apps {Array} [{id, label, icon}] 홈 그리드에 표시할 앱 목록
   * @param dockIds {Array} 하단 독에 고정할 앱 id (최대 4개)
   */
  construct: function(apps, dockIds) {
    this.base(arguments, new qx.ui.layout.VBox());

    this.__apps = apps || [];
    this.__dockIds = dockIds || [];

    // iOS 풍 그라디언트 배경
    this.setDecorator(new qx.ui.decoration.Decorator().set({
      startColor: "#3E2B75",
      endColor: "#B44A6B",
      orientation: "vertical"
    }));

    this._createStatusBar();
    this._createIconGrid();
    this._createDock();

    this.addListener("disappear", this._stopClock, this);
    this.addListener("appear", this._startClock, this);
  },

  destruct: function() {
    this._stopClock();
  },

  members: {
    __apps: null,
    __dockIds: null,
    __clockLabel: null,
    __clockTimer: null,

    _createStatusBar: function() {
      var bar = new qx.ui.container.Composite(new qx.ui.layout.HBox());
      bar.set({height: 30, paddingLeft: 16, paddingRight: 16, backgroundColor: "rgba(0,0,0,0.25)"});

      this.__clockLabel = new qx.ui.basic.Label("");
      this.__clockLabel.set({
        textColor: "#FFFFFF",
        font: qx.bom.Font.fromString("bold 13px Tahoma"),
        alignY: "middle"
      });
      bar.add(this.__clockLabel);

      bar.add(new qx.ui.core.Spacer(), {flex: 1});

      var title = new qx.ui.basic.Label("DeskWeb");
      title.set({textColor: "rgba(255,255,255,0.8)", alignY: "middle", font: qx.bom.Font.fromString("12px Tahoma")});
      bar.add(title);

      this.add(bar);
      this._updateClock();
    },

    _startClock: function() {
      this._stopClock();
      this.__clockTimer = new qx.event.Timer(1000 * 20);
      this.__clockTimer.addListener("interval", this._updateClock, this);
      this.__clockTimer.start();
      this._updateClock();
    },

    _stopClock: function() {
      if (this.__clockTimer) {
        this.__clockTimer.stop();
        this.__clockTimer.dispose();
        this.__clockTimer = null;
      }
    },

    _updateClock: function() {
      if (this.__clockLabel) {
        var now = new Date();
        var h = now.getHours();
        var m = now.getMinutes();
        this.__clockLabel.setValue(
          (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m
        );
      }
    },

    _createIconGrid: function() {
      var scroll = new qx.ui.container.Scroll();

      var grid = new qx.ui.container.Composite(new qx.ui.layout.Flow(8, 18, "center"));
      grid.set({padding: [24, 8, 24, 8]});

      var dockIds = this.__dockIds;
      this.__apps.forEach(function(app) {
        if (dockIds.indexOf(app.id) !== -1) {
          return; // 독에 있는 앱은 그리드에서 제외
        }
        grid.add(this._createAppTile(app, 74));
      }, this);

      scroll.add(grid);
      this.add(scroll, {flex: 1});
    },

    _createDock: function() {
      var dockWrap = new qx.ui.container.Composite(new qx.ui.layout.HBox(0, "center"));
      dockWrap.set({padding: [6, 10, 14, 10]});

      var dock = new qx.ui.container.Composite(new qx.ui.layout.HBox(14, "center"));
      dock.set({
        padding: 10,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 24,
          backgroundColor: "rgba(255,255,255,0.22)"
        })
      });

      this.__dockIds.forEach(function(id) {
        for (var i = 0; i < this.__apps.length; i++) {
          if (this.__apps[i].id === id) {
            dock.add(this._createAppTile(this.__apps[i], 64, true));
            break;
          }
        }
      }, this);

      dockWrap.add(dock);
      this.add(dockWrap);
    },

    /**
     * iOS 스타일 앱 타일 (둥근 사각 아이콘 + 라벨)
     */
    _createAppTile: function(app, tileWidth, hideLabel) {
      var tile = new qx.ui.container.Composite(new qx.ui.layout.VBox(5, null, null));
      tile.set({width: tileWidth, cursor: "pointer", allowGrowX: false});
      tile.getLayout().setAlignX("center");

      var iconBox = new qx.ui.container.Composite(new qx.ui.layout.HBox(0, "center"));
      iconBox.set({
        width: 58,
        height: 58,
        allowGrowX: false,
        allowGrowY: false,
        decorator: new qx.ui.decoration.Decorator().set({
          radius: 14,
          backgroundColor: "rgba(255,255,255,0.9)"
        })
      });
      var icon = new qx.ui.basic.Image(app.icon);
      icon.set({scale: true, width: 44, height: 44, alignY: "middle"});
      iconBox.add(icon);
      tile.add(iconBox);

      if (!hideLabel) {
        var label = new qx.ui.basic.Label(app.label);
        label.set({
          textColor: "#FFFFFF",
          font: qx.bom.Font.fromString("11px Tahoma"),
          textAlign: "center",
          allowGrowX: true,
          rich: false
        });
        tile.add(label);
      }

      tile.addListener("tap", function() {
        this.fireDataEvent("launch", app.id);
      }, this);

      return tile;
    }
  }
});
