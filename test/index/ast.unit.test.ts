// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import { AstList, AstTokenType, AstValueType, createPosition, createToken, findValue, getMapValue, getStringValue, getText, getTokenAtPosition, getValue, getValueType, matchPath, NodeType, pathStartsWith, splitTokenAtPosition, VisitedNode, walk } from '../../src/index/ast';
import { parseHcl } from '../../src/index/hcl-hil';


suite("Index Tests", () => {
    suite("Parser Tests", () => {
        test("Can parse simple .tf", () => {
            const [ast, error] = parseHcl(`template "aws_s3_bucket" "bucket" {}`);

            assert.equal(ast.Node.Items.length, 1);

            const item = ast.Node.Items[0];

            assert.equal(item.Keys.length, 3);
        });

        test("Walk emits Item nodes", () => {
            const [a, error] = parseHcl(`template "aws_s3_bucket" "bucket" {}`);

            let found = [];
            walk(a, (type: NodeType, node: any, path: VisitedNode[], index?: number, array?: any[]) => {
                if (type === NodeType.Item) {
                    found.push(node);
                }
            });

            assert.equal(found.length, 1);
        });

        test("Walk emits Key nodes with index and array", () => {
            const [ast, error] = parseHcl(`template "aws_s3_bucket" "bucket" {}`);

            let found = [];
            walk(ast, (type: NodeType, node: any, path: VisitedNode[], index?: number, array?: any[]) => {
                if (type === NodeType.Key) {
                    found.push([index, array.length]);
                }
            });

            assert.deepEqual(found, [[0, 3], [1, 3], [2, 3]]);
        });
    });

    suite("Ast extraction", () => {
        const [ast, error] = parseHcl('variable "region" { default = "defaultValue" }');

        test("findValue return AstVal for existing key", () => {
            let val = findValue(ast.Node.Items[0], "default");

            assert.notEqual(val, null);
        });

        test("findValue does not fail if key is missing", () => {
            let val = findValue(ast.Node.Items[0], "type");

            assert.equal(val, null);
        });

        test("getText returns the text of a token", () => {
            let list = ast.Node.Items[0].Val.List as AstList
            let text = getText(list.Items[0].Keys[0].Token);

            assert.equal(text, "default");
        });

        test("getText does not strip quotes by default", () => {
            let val = findValue(ast.Node.Items[0], "default");
            let text = getText(val.Token);

            assert.equal(text, '"defaultValue"');
        });

        test("getText can strip quotes if requested", () => {
            let val = findValue(ast.Node.Items[0], "default");
            let text = getText(val.Token, { stripQuotes: true });

            assert.equal(text, 'defaultValue');
        });

        test("getStringValue returns the string", () => {
            let val = findValue(ast.Node.Items[0], "default");
            let text = getStringValue(val, "...");

            assert.equal(text, '"defaultValue"');
        });

        test("getStringValue can strip quotes", () => {
            let val = findValue(ast.Node.Items[0], "default");
            let text = getStringValue(val, "...", { stripQuotes: true });

            assert.equal(text, 'defaultValue');
        });

        test("getStringValue returns the fallback", () => {
            let text = getStringValue(null, "fallback");

            assert.equal(text, "fallback");
        });

        test("getValue can return a Map<string, string>", () => {
            let map = getValue(ast.Node.Items[0].Val) as Map<string, string>;

            assert.equal(map.get("default"), '"defaultValue"');
        });

        test("getMapValue can return a Map<string, string>", () => {
            let map = getMapValue(ast.Node.Items[0].Val);

            assert.equal(map.get("default"), '"defaultValue"');
        });

        test("getMapValue returns empty map on string value", () => {
            let list = ast.Node.Items[0].Val.List as AstList;
            let map = getMapValue(list.Items[0].Val);

            assert.equal(map.size, 0);
        });

        test("getMapValue returns empty map on list value", () => {
            let [ast2, error2] = parseHcl(`locals { a = [] }`);

            let list = ast2.Node.Items[0].Val.List as AstList;
            let map = getMapValue(list.Items[0].Val);

            assert.equal(map.size, 0);
        });
    });

    suite("Ast helpers", () => {
        suite("getValueType", () => {
            test("string value", () => {
                let [ast3, error3] = parseHcl(`locals { a = "string" }`);

                let list = ast3.Node.Items[0].Val.List as AstList;
                assert.equal(getValueType(list.Items[0].Val), AstValueType.String);
            });

            test("list value", () => {
                let [ast3, error3] = parseHcl(`locals { a = ["list"] }`);

                let list = ast3.Node.Items[0].Val.List as AstList;
                assert.equal(getValueType(list.Items[0].Val), AstValueType.List);
            });

            test("map value", () => {
                let [ast3, error3] = parseHcl(`locals { a = { p = "string" } }`);

                let list = ast3.Node.Items[0].Val.List as AstList;
                assert.equal(getValueType(list.Items[0].Val), AstValueType.Map);
            });
        });

        suite("getTokenAtPosition", () => {
            test("string", () => {
                let [ast, error] = parseHcl(`locals { a = "" }`);

                let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 1, Column: 15 }, "ALL", "ANY");
                assert(token);
                assert.equal(token.Text, '""');
                assert.equal(token.Type, AstTokenType.STRING);
                assert.equal(token.Pos.Line, 1);
                assert.equal(token.Pos.Column, 14);
            });

            test("boolean", () => {
                let [ast, error] = parseHcl(`locals { a = true }`);

                let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 1, Column: 15 }, "ALL", "ANY");
                assert(token);
                assert.equal(token.Text, 'true');
                assert.equal(token.Type, AstTokenType.BOOL);
                assert.equal(token.Pos.Line, 1);
                assert.equal(token.Pos.Column, 14);
            });

            suite("multiline heredoc", () => {
                test("happy case", () => {
                    let [ast, error] = parseHcl(`locals {\n  a = <<EOF\nb\nc\nd\nEOF\n }`);

                    let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 3, Column: 1 }, "ALL", "ANY");
                    assert(token);
                    assert.equal(token.Text, '<<EOF\nb\nc\nd\nEOF\n');
                    assert.equal(token.Type, AstTokenType.HEREDOC);
                    assert.equal(token.Pos.Line, 2);
                    assert.equal(token.Pos.Column, 7);
                });

                test("first line before start column", () => {
                    let [ast, error] = parseHcl(`locals {\n  a = <<EOF\nb\nc\nd\nEOF\n }`);

                    let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 2, Column: 6 }, "ALL", "ANY");
                    assert(!token);
                });

                test("first line after start column", () => {
                    let [ast, error] = parseHcl(`locals {\n  a = <<EOF\nb\nc\nd\nEOF\n }`);

                    let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 2, Column: 8 }, "ALL", "ANY");
                    assert(!token);
                });

                test("last line", () => {
                    let [ast, error] = parseHcl(`locals {\n  a = <<EOF\nb\nc\nd\nEOF\n }`);

                    let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 6, Column: 2 }, "ALL", "ANY");
                    assert(!token);
                });

                test("all lines inside the heredoc", () => {
                    let [ast, error] = parseHcl(`locals {\n  a = <<EOF\nb\nc\nd\nEOF\n }`);

                    for (const line of [3, 4, 5]) {
                        let [token, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: line, Column: 1 }, "ALL", "ANY");
                        assert(token, `expected to find token at line ${line}`);
                        assert.equal(token.Text, '<<EOF\nb\nc\nd\nEOF\n');
                        assert.equal(token.Type, AstTokenType.HEREDOC);
                        assert.equal(token.Pos.Line, 2);
                        assert.equal(token.Pos.Column, 7);
                    }
                });
            });

            suite("multiline comments", () => {
                test("single line comment", () => {
                    let [ast, error] = parseHcl(`# comment 1\n# comment 2`);

                    let [token1, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 1, Column: 1 }, "ALL", "ANY");
                    assert(!token1); // currently not supported
                });

                test("multi line comment", () => {
                    let [ast, error] = parseHcl(`/* comment 1\n comment 2 */`);

                    let [token1, path] = getTokenAtPosition(ast, { Filename: "", Offset: 0, Line: 1, Column: 1 }, "ALL", "ANY");
                    assert(!token1); // currently not supported
                });
            });
        });

        suite("splitTokenAtPosition", () => {
            test("outside of token before same start line", () => {
                const token = createToken(AstTokenType.STRING, "Text", 2, 5);
                const position = createPosition(2, 3);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert(!pre);
                assert(!suf);
            });

            test("outside of token after same start line", () => {
                const token = createToken(AstTokenType.STRING, "Text", 2, 1);
                const position = createPosition(2, 10);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert(!pre);
                assert(!suf);
            });

            test("outside of token after same end line", () => {
                const token = createToken(AstTokenType.STRING, "Text\nText", 1, 1);
                const position = createPosition(2, 5);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert(!pre);
                assert(!suf);
            });

            test("split single line token", () => {
                const token = createToken(AstTokenType.STRING, "Text", 1, 1);
                const position = createPosition(1, 3);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert.equal(pre, "Te");
                assert.equal(suf, "xt");
            });

            test("split multiline token first line", () => {
                const token = createToken(AstTokenType.STRING, "Text\nText", 1, 1);
                const position = createPosition(1, 3);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert.equal(pre, "Te");
                assert.equal(suf, "xt\nText");
            });

            test("split multiline token last line", () => {
                const token = createToken(AstTokenType.STRING, "Text\nText", 1, 1);
                const position = createPosition(2, 3);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert.equal(pre, "Text\nTe");
                assert.equal(suf, "xt");
            });

            test("split multiline token middle line", () => {
                const token = createToken(AstTokenType.STRING, "Text\nText\nText", 1, 1);
                const position = createPosition(2, 3);

                const [pre, suf] = splitTokenAtPosition(token, position);
                assert.equal(pre, "Text\nTe");
                assert.equal(suf, "xt\nText");
            });
        });

        suite("pathStartsWith, pathMatch", () => {
            function toPath(...p: NodeType[]): VisitedNode[] {
                return p.map(e => { return { node: null, type: e }; });
            }

            test("happy case", () => {
                let path = toPath(NodeType.Unknown, NodeType.Node, NodeType.Item);

                assert(pathStartsWith(path, ["ANY", "ANY", NodeType.Item]));
            });

            test("match too long", () => {
                let path = toPath(NodeType.Item);

                assert(!pathStartsWith(path, ["ANY", "ANY", NodeType.Item]));
            });

            test("mismatch", () => {
                let path = toPath(NodeType.Unknown, NodeType.Node, NodeType.Item);

                assert(!pathStartsWith(path, [NodeType.Value]));
            });

            test("match shorter than path", () => {
                let path = toPath(NodeType.Unknown, NodeType.Node, NodeType.Item);

                assert(pathStartsWith(path, [NodeType.Unknown]));
            });

            test("matchPath only matches on same length", () => {
                let path = toPath(NodeType.Unknown, NodeType.Node, NodeType.Item);

                assert(!matchPath(path, [NodeType.Unknown]));
            });

            test("matchPath matches on same length", () => {
                let path = toPath(NodeType.Unknown);

                assert(matchPath(path, [NodeType.Unknown]));
            });
        });
    });
});