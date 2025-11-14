/* ...existing code ... */
    // Goal flag
    const g = this.level.goal;
    this._rect(g.x, g.y, 4, g.h, "#36c67a");
    this._rect(g.x + 4, g.y, g.w - 4, 18, "#36c67a");

+    // Boss (every 20th level)
+    if (this.level.boss) {
+      const b = this.level.boss;
+      // body
+      this._rect(b.x, b.y, b.w, b.h, "#5b1f1f");
+      // eyes
+      this._rect(b.x + 16, b.y + 20, 12, 10, "#fff");
+      this._rect(b.x + b.w - 28, b.y + 20, 12, 10, "#fff");
+      this._rect(b.x + 20, b.y + 22, 6, 6, "#0f1416");
+      this._rect(b.x + b.w - 24, b.y + 22, 6, 6, "#0f1416");
+    }
/* ...existing code ... */

