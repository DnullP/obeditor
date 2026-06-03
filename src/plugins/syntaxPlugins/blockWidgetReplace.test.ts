/**
 * @module plugins/markdown-codemirror/editor/syntaxPlugins/blockWidgetReplace.test
 * @description 块级 widget 替换工具回归测试：校验源码展开态的高度预算，避免组件切回源码时
 *   下方内容出现明显位移。
 */

import { describe, expect, test } from "bun:test";
import {
    resolveSourceVisibleBlockReserveLineMinHeight,
} from "./blockWidgetReplace";

describe("resolveSourceVisibleBlockReserveLineMinHeight", () => {
    test("源码自然高度小于 widget 时应把差值补到首行 min-height", () => {
        expect(resolveSourceVisibleBlockReserveLineMinHeight({
            estimatedWidgetHeight: 682,
            sourceLineCount: 17,
            lineHeight: 27,
        })).toBe(250);
    });

    test("源码自然高度已覆盖 widget 时不应额外撑高", () => {
        expect(resolveSourceVisibleBlockReserveLineMinHeight({
            estimatedWidgetHeight: 120,
            sourceLineCount: 6,
            lineHeight: 27,
        })).toBeNull();
    });

    test("非法或缺失 lineHeight 应使用稳定回退值", () => {
        expect(resolveSourceVisibleBlockReserveLineMinHeight({
            estimatedWidgetHeight: 108,
            sourceLineCount: 2,
            lineHeight: 0,
        })).toBe(81);
    });
});
