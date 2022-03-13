# 简介

nuomi-vscode是一款VSCode插件，用于自动插入文件头部信息。

# 主要功能

## 生成文件头部信息

### 快捷键

手动插入header
+ ctrl-alt-H ctrl-alt-H

插入修改log
+ ctrl-alt-C ctrl-alt-C

### 配置

**一般情况下，并不需要额外的配置。**如有需要，也可以通过配置实现定制化的文件头部信息。

#### 全局配置

settings.json设置如下：

```json
"nuomi-vscode.config": {
        "author": "nuomifans",
        "autoHeader":true,
        "ignore": [
            "*.json",            # 忽略后缀
            "test.py",           # 忽略文件
            "test"               # 忽略目录
        ]
    },
```

| 变量       | 说明                                                                       |
| ---------- | -------------------------------------------------------------------------- |
| author     | 这里或者自定义变量里都可以设置。如果没有定义，会尝试使用操作系统的fullname |
| autoHeader | 默认为true，新建或保存文件时，是否自动插入头部信息                         |
| ignore     | 忽略的文件、文件夹或者特定后缀的文件                                       |

#### 自定义模板

```json
"nuomi-vscode.templates": [
    {
        "language": "Lua",
        "headerBegin": "--[[",
        "headerPrefix": "-- ",
        "headerEnd": "--]]",
        "template": [
            "@file: {{file | replace workspaceFolder | replace assetPath | replace '.lua' | replace pathSeparator '.'}}",
            "@author: {{author}}",
            "@created: {{createdDate}}",
            "@description: {{description}}",
            "-----",
            "@last-modified: {{lastModifiedDate}}",
            "@modified by: {{author}}",
            "-----",
            "@Copyright (c) {{year}} {{company}}",
            "-----",
        ]
    }
],
```

这里使用[art-template](http://aui.github.io/art-template/zh-cn/docs/)解析模板，生成最终的信息。`{{var}}`双大括号里可使用我们自定义的变量及支持的VSCode变量。

ps:如果模板包含`last-modified:`或者`modified by:`，则保存文件时会自动更新它们的值。

#### 自定义变量

```json
"nuomi-vscode.variables": [
    [
        "assetPath",
        "\\Assets\\Lua\\"
    ],
],
```

#### 支持的VSCode变量

| 变量                    | 说明                                    |
| ----------------------- | --------------------------------------- |
| file                    | 当前文件的绝对路径                      |
| relativeFile            | 当前文件的相对路径(剔除workspaceFolder) |
| createdDate             | 当前文件的创建时间                      |
| date或lastModifiedDate  | 当前时间                                |
| workspaceFolder         | 当前工作路径                            |
| workspaceFolderBasename | 当前工作路径                            |
| fileBasename            | 当前文件名                              |
| fileBasenameNoExtension | 当前文件名(不带后缀)                    |
| fileDirname             | 当前文件目录名称                        |
| fileExtname             | 文件扩展名                              |
| pathSeparator           | 路径分隔符                              |
| year                    | 年份                                    |

#### 自定义方法

`{{value | filter}}` 过滤器语法类似管道操作符，它的上一个输出作为下一个输入。

上述例子`{{file | replace workspaceFolder | replace assetPath | replace '.lua' | replace pathSeparator '.'}}`,剔除了工作路径，`\Assets\Lua\`路径，去掉了`.lua`后缀，替换了分隔符为`.`

当前支持的方法有：

| 方法       | 说明                                                            |
| ---------- | --------------------------------------------------------------- |
| replace    | 替换字符串，第2个参数不填则替换为空字符                         |
| upper      | 将字符串转换成大写                                              |
| lower      | 将字符串转换成小写                                              |
| dateformat | 格式化时间，如`{{data \| dateformat 'YYYY年MM月DD日 HH:mm:ss'}}` |

### 参考

参考了[psi-header](https://github.com/davidquinn/psi-header)的实现，功能基本相同，去除了复杂的配置，增加了自定义的方法来处理一些特殊情况。

