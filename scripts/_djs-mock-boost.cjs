
const { Collection } = require("/home/daytona/codebase/bot/test-djs-mock.cjs");
module.exports = {
  Colors: new Proxy({}, { get: () => 0x000000 }),
  AuditLogEvent: new Proxy({}, { get: () => 1 }),
  EmbedBuilder: class { constructor(d = {}) { this.d = { ...d }; } setColor(c) { this.d.color = c; return this; } setTitle(t) { this.d.title = t; return this; } setDescription(x) { this.d.description = x; return this; } addFields(f) { this.d.fields = (this.d.fields || []).concat(f); return this; } setFooter(f) { this.d.footer = f; return this; } setTimestamp() { return this; } },
  AttachmentBuilder: class {},
  PermissionFlagsBits: new Proxy({}, { get: () => 1n }),
  Collection,
};
