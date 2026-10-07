const test = require("node:test");
const assert = require("node:assert/strict");
const { filterSectionsByPermissions } = require("../../.navigation-test-build/navigation/sidebarPermissions.js");

const sections = [
  {
    id: "quality",
    labelKey: "quality",
    icon: "Q",
    module: "quality",
    order: 1,
    items: [
      { id: "quality.dashboard", labelKey: "dashboard", path: "/quality", icon: "D" },
      { id: "quality.settings", labelKey: "settings", path: "/quality/settings", icon: "S", requiredAction: "edit" },
    ],
  },
  {
    id: "administration",
    labelKey: "administration",
    icon: "A",
    module: "administration",
    order: 2,
    items: [
      { id: "administration.users", labelKey: "users", path: "/settings/users", icon: "U" },
    ],
  },
];

test("view permission shows module but hides edit-only items", () => {
  const visible = filterSectionsByPermissions(sections, {
    quality: ["view"],
    administration: [],
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, "quality");
  assert.deepEqual(visible[0].items.map((item) => item.id), ["quality.dashboard"]);
});

test("edit permission exposes edit-only item when view is also granted", () => {
  const visible = filterSectionsByPermissions(sections, {
    quality: ["view", "edit"],
    administration: [],
  });

  assert.deepEqual(
    visible[0].items.map((item) => item.id),
    ["quality.dashboard", "quality.settings"],
  );
});

test("missing module view permission hides the complete section", () => {
  const visible = filterSectionsByPermissions(sections, {
    quality: ["edit"],
    administration: [],
  });

  assert.deepEqual(visible, []);
});

test("administration visibility follows effective permission, not a role name", () => {
  const visible = filterSectionsByPermissions(sections, {
    quality: [],
    administration: ["view"],
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].id, "administration");
});
