/**
 * Calc Tutorial Manager
 * Interactive step-by-step tutorial system for the Calc application
 * Features:
 * - Step-by-step guidance
 * - Highlight elements
 * - Tooltips with explanations
 * - Progress tracking
 * - Settings to enable/disable
 *
 * @asset(deskweb/*)
 */
qx.Class.define("deskweb.util.CalcTutorialManager", {
  extend: qx.core.Object,

  /**
   * Constructor
   * @param calcWindow {deskweb.ui.CalcWindow} The calc window instance
   */
  construct: function(calcWindow) {
    this.base(arguments);

    this.__calcWindow = calcWindow;
    this.__currentStep = 0;
    this.__isActive = false;
    this.__completedSteps = this._loadCompletedSteps();
    this.__tutorialEnabled = this._loadTutorialEnabled();

    // Define tutorial steps
    this.__tutorialSteps = [
      {
        id: "welcome",
        title: "Welcome to Calc!",
        content: "This tutorial will help you learn the basics of using the spreadsheet application. Click 'Next' to continue or 'Skip Tutorial' to close.",
        target: null, // No specific target, center dialog
        position: "center"
      },
      {
        id: "cell-address",
        title: "Cell Address",
        content: "This shows the current cell reference. Cells are identified by column letter (A, B, C...) and row number (1, 2, 3...). For example, 'A1' is the first cell.",
        target: "cell-address",
        position: "below"
      },
      {
        id: "formula-input",
        title: "Formula Bar",
        content: "Enter values or formulas here. Formulas start with '=' (e.g., =SUM(A1:A10)). Press Enter to confirm or Escape to cancel.",
        target: "formula-input",
        position: "below"
      },
      {
        id: "function-insert",
        title: "Function Button",
        content: "Click 'fx' to see available functions like SUM, AVERAGE, IF, VLOOKUP and more. Functions help you perform calculations on your data.",
        target: "function-insert",
        position: "below"
      },
      {
        id: "font-family",
        title: "Font Selection",
        content: "Choose different fonts for your cells. Select cells first, then pick a font from this dropdown.",
        target: "font-family",
        position: "below"
      },
      {
        id: "font-size",
        title: "Font Size",
        content: "Change the text size. Select cells and choose a size from 8pt to 72pt.",
        target: "font-size",
        position: "below"
      },
      {
        id: "bold",
        title: "Bold Text",
        content: "Make text bold. Select cells and click 'B' or press Ctrl+B.",
        target: "bold",
        position: "below"
      },
      {
        id: "italic",
        title: "Italic Text",
        content: "Make text italic. Select cells and click 'I' or press Ctrl+I.",
        target: "italic",
        position: "below"
      },
      {
        id: "align-left",
        title: "Text Alignment",
        content: "Align text left, center, or right within cells. Numbers are typically right-aligned, text is left-aligned.",
        target: "align-left",
        position: "below"
      },
      {
        id: "font-color",
        title: "Font Color",
        content: "Change the text color. Click to enter a color code (e.g., #FF0000 for red).",
        target: "font-color",
        position: "below"
      },
      {
        id: "bg-color",
        title: "Background Color",
        content: "Highlight cells with a background color. Useful for making important data stand out.",
        target: "bg-color",
        position: "below"
      },
      {
        id: "merge-cells",
        title: "Merge Cells",
        content: "Combine multiple cells into one. Select cells and click 'Merge'. Useful for titles and headers.",
        target: "merge-cells",
        position: "below"
      },
      {
        id: "currency-format",
        title: "Currency Format",
        content: "Format numbers as currency ($). Select cells containing numbers and click '$'.",
        target: "currency-format",
        position: "below"
      },
      {
        id: "percent-format",
        title: "Percent Format",
        content: "Format numbers as percentages (%). Select cells and click '%'. Values are multiplied by 100.",
        target: "percent-format",
        position: "below"
      },
      {
        id: "auto-sum",
        title: "Auto Sum",
        content: "Quickly add a SUM formula. Select a range of numbers and click 'Sum' to insert a SUM formula below.",
        target: "auto-sum",
        position: "below"
      },
      {
        id: "add-sheet",
        title: "Sheet Tabs",
        content: "Manage multiple sheets in your workbook. Click '+' to add a new sheet. Right-click tabs to rename, delete, or copy sheets.",
        target: "add-sheet",
        position: "above"
      },
      {
        id: "keyboard-shortcuts",
        title: "Keyboard Shortcuts",
        content: "Speed up your work with shortcuts:\n\n• Ctrl+C: Copy\n• Ctrl+V: Paste\n• Ctrl+Z: Undo\n• Ctrl+S: Save\n• Arrow keys: Navigate\n• Enter: Move down\n• Tab: Move right\n• F2: Edit cell",
        target: null,
        position: "center"
      },
      {
        id: "formulas-intro",
        title: "Using Formulas",
        content: "Formulas are powerful! Try these:\n\n• =A1+B1 (add cells)\n• =SUM(A1:A10) (sum range)\n• =AVERAGE(A1:A10) (average)\n• =IF(A1>10,\"High\",\"Low\")\n\nCell references update when you copy formulas!",
        target: null,
        position: "center"
      },
      {
        id: "save-export",
        title: "Save & Export",
        content: "Use File menu to:\n\n• Save - Store to browser storage\n• Export ODS - Download as OpenDocument format\n• Import - Open ODS, XLSX files\n\nYour data stays on your computer!",
        target: null,
        position: "center"
      },
      {
        id: "complete",
        title: "Tutorial Complete!",
        content: "You've learned the basics of Calc! Explore more features through the menus. You can restart this tutorial anytime from Help > Tutorial.",
        target: null,
        position: "center"
      }
    ];

    console.log("[CalcTutorialManager] Initialized with", this.__tutorialSteps.length, "steps");
  },

  events: {
    /** Fired when tutorial step changes */
    "stepChange": "qx.event.type.Data",

    /** Fired when tutorial completes */
    "tutorialComplete": "qx.event.type.Event"
  },

  members: {
    __calcWindow: null,
    __currentStep: null,
    __isActive: null,
    __completedSteps: null,
    __tutorialEnabled: null,
    __tutorialSteps: null,
    __tooltipWidget: null,
    __overlayWidget: null,

    /**
     * Check if tutorial should be shown on startup
     */
    shouldShowTutorial: function() {
      return this.__tutorialEnabled && !this._isTutorialCompleted();
    },

    /**
     * Check if tutorial is completed
     */
    _isTutorialCompleted: function() {
      return localStorage.getItem("calc_tutorial_completed") === "true";
    },

    /**
     * Start the tutorial
     */
    startTutorial: function() {
      if (this.__isActive) return;

      this.__isActive = true;
      this.__currentStep = 0;
      this.__completedSteps = {};

      this._createOverlay();
      this._showStep(0);

      console.log("[CalcTutorialManager] Tutorial started");
    },

    /**
     * Stop the tutorial
     */
    stopTutorial: function() {
      if (!this.__isActive) return;

      this.__isActive = false;
      this._removeOverlay();
      this._removeTooltip();

      console.log("[CalcTutorialManager] Tutorial stopped");
    },

    /**
     * Go to next step
     */
    nextStep: function() {
      if (this.__currentStep < this.__tutorialSteps.length - 1) {
        this._markStepCompleted(this.__currentStep);
        this.__currentStep++;
        this._showStep(this.__currentStep);
      } else {
        this._completeTutorial();
      }
    },

    /**
     * Go to previous step
     */
    previousStep: function() {
      if (this.__currentStep > 0) {
        this.__currentStep--;
        this._showStep(this.__currentStep);
      }
    },

    /**
     * Skip to end of tutorial
     */
    skipTutorial: function() {
      this._completeTutorial();
    },

    /**
     * Show specific step
     */
    _showStep: function(stepIndex) {
      var step = this.__tutorialSteps[stepIndex];
      if (!step) return;

      this._removeTooltip();

      // Create tooltip
      this._createTooltip(step);

      // Highlight target element if specified
      if (step.target) {
        this._highlightElement(step.target);
      } else {
        this._clearHighlight();
      }

      this.fireDataEvent("stepChange", {
        step: stepIndex,
        total: this.__tutorialSteps.length,
        data: step
      });

      console.log("[CalcTutorialManager] Showing step", stepIndex + 1, "/", this.__tutorialSteps.length, ":", step.title);
    },

    /**
     * Create tutorial overlay
     */
    _createOverlay: function() {
      if (this.__overlayWidget) return;

      this.__overlayWidget = new qx.ui.core.Widget();
      this.__overlayWidget.set({
        backgroundColor: "rgba(0,0,0,0.3)",
        zIndex: 9998
      });

      var root = qx.core.Init.getApplication().getRoot();
      root.add(this.__overlayWidget, { edge: 0 });

      // Allow clicking through to buttons
      this.__overlayWidget.addListener("click", function(e) {
        // Check if click is on tutorial tooltip
        var target = e.getTarget();
        if (target && target.getLayoutParent() === this.__tooltipWidget) {
          return;
        }
      }, this);
    },

    /**
     * Remove overlay
     */
    _removeOverlay: function() {
      if (this.__overlayWidget) {
        var root = qx.core.Init.getApplication().getRoot();
        root.remove(this.__overlayWidget);
        this.__overlayWidget.dispose();
        this.__overlayWidget = null;
      }
    },

    /**
     * Create tooltip for current step
     */
    _createTooltip: function(step) {
      var root = qx.core.Init.getApplication().getRoot();

      // Create tooltip container
      this.__tooltipWidget = new qx.ui.container.Composite(new qx.ui.layout.VBox(10));
      this.__tooltipWidget.set({
        backgroundColor: "#FFFFFF",
        padding: 15,
        zIndex: 10000,
        width: 350,
        decorator: "main"
      });

      // Add shadow effect
      this.__tooltipWidget.getContentElement().setStyle("boxShadow", "0 4px 20px rgba(0,0,0,0.3)");
      this.__tooltipWidget.getContentElement().setStyle("borderRadius", "8px");

      // Step indicator
      var stepIndicator = new qx.ui.basic.Label(
        "Step " + (this.__currentStep + 1) + " of " + this.__tutorialSteps.length
      );
      stepIndicator.set({
        textColor: "#666666",
        font: "small"
      });
      this.__tooltipWidget.add(stepIndicator);

      // Title
      var title = new qx.ui.basic.Label(step.title);
      title.set({
        font: "bold",
        rich: true
      });
      this.__tooltipWidget.add(title);

      // Content
      var content = new qx.ui.basic.Label(step.content);
      content.set({
        rich: true,
        wrap: true
      });
      this.__tooltipWidget.add(content);

      // Progress bar - use Canvas layout for absolute positioning
      var progressContainer = new qx.ui.container.Composite(new qx.ui.layout.Canvas());
      progressContainer.set({ height: 4, marginTop: 10 });

      var progressBg = new qx.ui.core.Widget();
      progressBg.set({ backgroundColor: "#E0E0E0" });
      progressContainer.add(progressBg, { left: 0, right: 0, top: 0, bottom: 0 });

      var progressFill = new qx.ui.core.Widget();
      var progressPercent = ((this.__currentStep + 1) / this.__tutorialSteps.length) * 100;
      var progressWidth = Math.round(progressPercent * 3.2); // 320px max width
      progressFill.set({
        backgroundColor: "#339933",
        width: progressWidth,
        height: 4
      });
      progressContainer.add(progressFill, { left: 0, top: 0 });

      this.__tooltipWidget.add(progressContainer);

      // Buttons
      var buttonContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(10));
      buttonContainer.set({ marginTop: 10 });

      // Skip button
      var skipBtn = new qx.ui.form.Button("Skip Tutorial");
      skipBtn.set({
        appearance: "button",
        textColor: "#666666"
      });
      skipBtn.addListener("execute", this.skipTutorial, this);
      buttonContainer.add(skipBtn);

      buttonContainer.add(new qx.ui.core.Spacer(), { flex: 1 });

      // Previous button
      if (this.__currentStep > 0) {
        var prevBtn = new qx.ui.form.Button("Previous");
        prevBtn.addListener("execute", this.previousStep, this);
        buttonContainer.add(prevBtn);
      }

      // Next/Finish button
      var isLastStep = this.__currentStep >= this.__tutorialSteps.length - 1;
      var nextBtn = new qx.ui.form.Button(isLastStep ? "Finish" : "Next");
      nextBtn.set({
        backgroundColor: "#339933",
        textColor: "#FFFFFF"
      });
      nextBtn.addListener("execute", this.nextStep, this);
      buttonContainer.add(nextBtn);

      this.__tooltipWidget.add(buttonContainer);

      // Don't show again checkbox on last step
      if (isLastStep) {
        var checkContainer = new qx.ui.container.Composite(new qx.ui.layout.HBox(5));
        checkContainer.set({ marginTop: 10 });

        var dontShowCheck = new qx.ui.form.CheckBox("Don't show this tutorial again");
        dontShowCheck.setValue(true);
        dontShowCheck.addListener("changeValue", function(e) {
          localStorage.setItem("calc_tutorial_completed", e.getData() ? "true" : "false");
        }, this);
        checkContainer.add(dontShowCheck);

        this.__tooltipWidget.add(checkContainer);
      }

      root.add(this.__tooltipWidget);

      // Position tooltip
      this._positionTooltip(step);
    },

    /**
     * Position tooltip relative to target
     */
    _positionTooltip: function(step) {
      if (!this.__tooltipWidget) return;

      var root = qx.core.Init.getApplication().getRoot();
      var rootBounds = root.getBounds();

      if (step.position === "center" || !step.target) {
        // Center on screen
        qx.event.Timer.once(function() {
          var tooltipBounds = this.__tooltipWidget.getBounds();
          if (tooltipBounds && rootBounds) {
            this.__tooltipWidget.setLayoutProperties({
              left: Math.round((rootBounds.width - tooltipBounds.width) / 2),
              top: Math.round((rootBounds.height - tooltipBounds.height) / 2)
            });
          }
        }, this, 50);
      } else {
        // Position relative to target element
        var targetElement = this._findTargetElement(step.target);
        if (targetElement) {
          qx.event.Timer.once(function() {
            var targetBounds = targetElement.getBounds();
            var tooltipBounds = this.__tooltipWidget.getBounds();

            if (targetBounds && tooltipBounds) {
              var containerBounds = targetElement.getLayoutParent().getBounds();
              var absoluteLeft = targetBounds.left;
              var absoluteTop = targetBounds.top;

              // Traverse up to find absolute position
              var parent = targetElement.getLayoutParent();
              while (parent && parent.getBounds) {
                var parentBounds = parent.getBounds();
                if (parentBounds) {
                  absoluteLeft += parentBounds.left || 0;
                  absoluteTop += parentBounds.top || 0;
                }
                parent = parent.getLayoutParent ? parent.getLayoutParent() : null;
              }

              var left, top;

              if (step.position === "below") {
                left = absoluteLeft;
                top = absoluteTop + targetBounds.height + 10;
              } else if (step.position === "above") {
                left = absoluteLeft;
                top = absoluteTop - tooltipBounds.height - 10;
              } else if (step.position === "right") {
                left = absoluteLeft + targetBounds.width + 10;
                top = absoluteTop;
              } else if (step.position === "left") {
                left = absoluteLeft - tooltipBounds.width - 10;
                top = absoluteTop;
              }

              // Keep within screen bounds
              if (left + tooltipBounds.width > rootBounds.width) {
                left = rootBounds.width - tooltipBounds.width - 20;
              }
              if (top + tooltipBounds.height > rootBounds.height) {
                top = rootBounds.height - tooltipBounds.height - 20;
              }
              if (left < 0) left = 20;
              if (top < 0) top = 20;

              this.__tooltipWidget.setLayoutProperties({
                left: Math.round(left),
                top: Math.round(top)
              });
            }
          }, this, 100);
        }
      }
    },

    /**
     * Find target element by tutorial ID
     */
    _findTargetElement: function(targetId) {
      // Search in calc window's descendants
      var found = null;

      var search = function(widget) {
        if (widget.getUserData && widget.getUserData("tutorialId") === targetId) {
          return widget;
        }

        if (widget._getChildren) {
          var children = widget._getChildren();
          for (var i = 0; i < children.length; i++) {
            var result = search(children[i]);
            if (result) return result;
          }
        }

        if (widget.getChildren) {
          var children = widget.getChildren();
          for (var i = 0; i < children.length; i++) {
            var result = search(children[i]);
            if (result) return result;
          }
        }

        return null;
      };

      return search(this.__calcWindow);
    },

    /**
     * Highlight target element
     */
    _highlightElement: function(targetId) {
      var element = this._findTargetElement(targetId);
      if (element) {
        // Add highlight style
        element.getContentElement().setStyle("outline", "3px solid #339933");
        element.getContentElement().setStyle("outlineOffset", "2px");
        element.getContentElement().setStyle("zIndex", "9999");
        element.getContentElement().setStyle("position", "relative");

        this.__highlightedElement = element;
      }
    },

    /**
     * Clear highlight
     */
    _clearHighlight: function() {
      if (this.__highlightedElement) {
        this.__highlightedElement.getContentElement().setStyle("outline", "none");
        this.__highlightedElement.getContentElement().setStyle("outlineOffset", "0");
        this.__highlightedElement.getContentElement().setStyle("zIndex", "auto");
        this.__highlightedElement = null;
      }
    },

    /**
     * Remove tooltip
     */
    _removeTooltip: function() {
      this._clearHighlight();

      if (this.__tooltipWidget) {
        var root = qx.core.Init.getApplication().getRoot();
        root.remove(this.__tooltipWidget);
        this.__tooltipWidget.dispose();
        this.__tooltipWidget = null;
      }
    },

    /**
     * Mark step as completed
     */
    _markStepCompleted: function(stepIndex) {
      var step = this.__tutorialSteps[stepIndex];
      if (step) {
        this.__completedSteps[step.id] = true;
        this._saveCompletedSteps();
      }
    },

    /**
     * Complete tutorial
     */
    _completeTutorial: function() {
      localStorage.setItem("calc_tutorial_completed", "true");
      this.stopTutorial();
      this.fireEvent("tutorialComplete");

      console.log("[CalcTutorialManager] Tutorial completed");
    },

    /**
     * Reset tutorial progress
     */
    resetTutorial: function() {
      localStorage.removeItem("calc_tutorial_completed");
      this.__completedSteps = {};
      this._saveCompletedSteps();

      console.log("[CalcTutorialManager] Tutorial progress reset");
    },

    /**
     * Enable/disable tutorial
     */
    setTutorialEnabled: function(enabled) {
      this.__tutorialEnabled = enabled;
      localStorage.setItem("calc_tutorial_enabled", enabled ? "true" : "false");
    },

    /**
     * Check if tutorial is enabled
     */
    isTutorialEnabled: function() {
      return this.__tutorialEnabled;
    },

    /**
     * Load completed steps from storage
     */
    _loadCompletedSteps: function() {
      try {
        var data = localStorage.getItem("calc_tutorial_steps");
        return data ? JSON.parse(data) : {};
      } catch (e) {
        return {};
      }
    },

    /**
     * Save completed steps to storage
     */
    _saveCompletedSteps: function() {
      try {
        localStorage.setItem("calc_tutorial_steps", JSON.stringify(this.__completedSteps));
      } catch (e) {
        console.error("[CalcTutorialManager] Error saving steps:", e);
      }
    },

    /**
     * Load tutorial enabled setting
     */
    _loadTutorialEnabled: function() {
      var stored = localStorage.getItem("calc_tutorial_enabled");
      return stored !== "false"; // Default to true
    },

    /**
     * Show contextual help for a feature
     */
    showFeatureHelp: function(featureId) {
      // Find step for this feature
      for (var i = 0; i < this.__tutorialSteps.length; i++) {
        if (this.__tutorialSteps[i].id === featureId) {
          this.__currentStep = i;
          this._createOverlay();
          this._showStep(i);
          return true;
        }
      }
      return false;
    },

    /**
     * Get current step info
     */
    getCurrentStep: function() {
      return {
        index: this.__currentStep,
        total: this.__tutorialSteps.length,
        step: this.__tutorialSteps[this.__currentStep]
      };
    },

    /**
     * Check if tutorial is active
     */
    isActive: function() {
      return this.__isActive;
    }
  },

  destruct: function() {
    this._removeTooltip();
    this._removeOverlay();
  }
});
