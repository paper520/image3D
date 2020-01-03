/*!
* image3D - 🍊 使用webGL绘制三维图片。Drawing three-dimensional images using webGL.
* git+https://github.com/yelloxing/image3D.git
*
* author 心叶
*
* version 2.0.1-alpha
*
* build Thu Apr 11 2019
*
* Copyright yelloxing
* Released under the MIT license
*
* Date:Sat Jan 04 2020 04:15:35 GMT+0800 (GMT+08:00)
*/

'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

(function () {
    'use strict';

    /**
     * 着色器一些公共的方法
     * --------------------------------------------
     * 主要是和生成特定着色器无关的方法
     * 着色器分为二类：顶点着色器 + 片段着色器
     * 前者用于定义一个点的特性，比如位置，大小，颜色等
     * 后者用于针对每个片段（可以理解为像素）进行处理
     *
     * 着色器采用的语言是：GLSL ES语言
     */

    // 把着色器字符串加载成着色器对象

    var loadShader = function loadShader(gl, type, source) {
        // 创建着色器对象
        var shader = gl.createShader(type);
        if (shader == null) throw new Error('Unable to create shader!');
        // 绑定资源
        gl.shaderSource(shader, source);
        // 编译着色器
        gl.compileShader(shader);
        // 检测着色器编译是否成功
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Failed to compile shader:' + gl.getShaderInfoLog(shader));
        return shader;
    };

    // 初始化着色器
    var useShader = function useShader(gl, vshaderSource, fshaderSource) {
        // 分别加载顶点着色器对象和片段着色器对象
        var vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshaderSource),
            fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshaderSource);
        // 创建一个着色器程序
        var glProgram = gl.createProgram();
        // 把前面创建的二个着色器对象添加到着色器程序中
        gl.attachShader(glProgram, vertexShader);
        gl.attachShader(glProgram, fragmentShader);
        // 把着色器程序链接成一个完整的程序
        gl.linkProgram(glProgram);
        // 检测着色器程序链接是否成功
        if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) throw new Error('Failed to link program: ' + gl.getProgramInfoLog(glProgram));
        // 使用这个完整的程序
        gl.useProgram(glProgram);
        return glProgram;
    };

    /**
     * 缓冲区核心方法
     * --------------------------------------------
     * 缓冲区分为二种：
     *  1.缓冲区中保存了包含顶点的数据
     *  2.缓冲区保存了包含顶点的索引值
     *
     */

    // 获取一个新的缓冲区
    // isElement默认false，创建第一种缓冲区，为true创建第二种
    var newBuffer = function newBuffer(gl, isElement) {
        var buffer = gl.createBuffer(),
            TYPE = isElement ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
        // 把缓冲区对象绑定到目标
        gl.bindBuffer(TYPE, buffer);
        return buffer;
    };

    // 数据写入缓冲区
    // data是一个类型化数组，表示写入的数据
    // usage表示程序如何使用存储在缓冲区的数据
    var writeBuffer = function writeBuffer(gl, data, usage, isElement) {
        var TYPE = isElement ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
        gl.bufferData(TYPE, data, usage);
    };

    // 使用缓冲区数据
    // location指定待分配的attribute变量的存储位置
    // size每个分量个数
    // type数据类型，应该是以下的某个：
    //      gl.UNSIGNED_BYTE    Uint8Array
    //      gl.SHORT            Int16Array
    //      gl.UNSIGNED_SHORT   Uint16Array
    //      gl.INT              Int32Array
    //      gl.UNSIGNED_INT     Uint32Array
    //      gl.FLOAT            Float32Array
    // stride相邻二个数据项的字节数
    // offset数据的起点字节位置
    // normalized是否把非浮点型的数据归一化到[0,1]或[-1,1]区间
    var useBuffer = function useBuffer(gl, location, size, type, stride, offset, normalized) {
        // 把缓冲区对象分配给目标变量
        gl.vertexAttribPointer(location, size, type, normalized || false, stride || 0, offset || 0);
        // 连接目标对象和缓冲区对象
        gl.enableVertexAttribArray(location);
    };

    /**
     * 纹理方法
     * --------------------------------------------
     * 在绘制的多边形上贴图
     * 丰富效果
     */

    // 初始化一个纹理对象
    // type有gl.TEXTURE_2D代表二维纹理，gl.TEXTURE_CUBE_MAP 立方体纹理等
    var initTexture = function initTexture(gl, unit, type) {
        // 创建纹理对象
        var texture = gl.createTexture();
        // 开启纹理单元，unit表示开启的编号
        gl.activeTexture(gl['TEXTURE' + unit]);
        // 绑定纹理对象到目标上
        gl.bindTexture(type, texture);
        return texture;
    };

    // 配置纹理
    var configTexture = function configTexture(gl, type, config) {
        var key = void 0;
        for (key in config) {
            /**
             *
             * 可配置项有四个：
             *  1. gl.TEXTURE_MAX_FILTER：放大方法
             *  2. gl.TEXTURE_MIN_FILTER：缩小方法
             *  3. gl.TEXTURE_WRAP_S：水平填充方法
             *  4. gl.TEXTURE_WRAP_T：垂直填充方法
             *
             */
            gl.texParameteri(type, gl[key], gl[config[key]]);
        }
    };

    // 链接资源图片
    // level默认传入0即可，和金字塔纹理有关
    // format表示图像的内部格式：
    //      gl.RGB(红绿蓝)
    //      gl.RGBA(红绿蓝透明度)
    //      gl.ALPHA(0.0,0.0,0.0,透明度)
    //      gl.LUMINANCE(L、L、L、1L:流明)
    //      gl.LUMINANCE_ALPHA(L、L、L,透明度)
    // textureType表示纹理数据的格式：
    //      gl.UNSIGNED_BYTE: 表示无符号整形，每一个颜色分量占据1字节
    //      gl.UNSIGNED_SHORT_5_6_5: 表示RGB，每一个分量分别占据占据5, 6, 5比特
    //      gl.UNSIGNED_SHORT_4_4_4_4: 表示RGBA，每一个分量分别占据占据4, 4, 4, 4比特
    //      gl.UNSIGNED_SHORT_5_5_5_1: 表示RGBA，每一个分量分别占据占据5比特，A分量占据1比特
    var linkImage = function linkImage(gl, type, level, format, textureType, image) {
        format = {
            "rgb": gl.RGB,
            "rgba": gl.RGBA,
            "alpha": gl.ALPHA
        }[format] || gl.RGB;

        gl.texImage2D(type, level, format, format, {
            // todo
        }[textureType] || gl.UNSIGNED_BYTE, image);
    };

    function value(gl) {
        return {

            /**
             * attribue
             * ----------------------------------------
             */

            // 浮点数
            setAttribute1f: function setAttribute1f(name, v0) {
                // 获取存储位置
                var location = gl.getAttribLocation(gl.program, name);
                // 传递数据给变量
                gl.vertexAttrib1f(location, v0);
            },
            setAttribute2f: function setAttribute2f(name, v0, v1) {
                var location = gl.getAttribLocation(gl.program, name);
                gl.vertexAttrib2f(location, v0, v1);
            },
            setAttribute3f: function setAttribute3f(name, v0, v1, v2) {
                var location = gl.getAttribLocation(gl.program, name);
                gl.vertexAttrib3f(location, v0, v1, v2);
            },
            setAttribute4f: function setAttribute4f(name, v0, v1, v2, v3) {
                var location = gl.getAttribLocation(gl.program, name);
                gl.vertexAttrib4f(location, v0, v1, v2, v3);
            },


            // 整数
            setAttribute1i: function setAttribute1i(name, v0) {
                // 获取存储位置
                var location = gl.getAttribLocation(gl.program, name);
                // 传递数据给变量
                gl.vertexAttrib1i(location, v0);
            },
            setAttribute2i: function setAttribute2i(name, v0, v1) {
                var location = gl.getAttribLocation(gl.program, name);
                gl.vertexAttrib2i(location, v0, v1);
            },
            setAttribute3i: function setAttribute3i(name, v0, v1, v2) {
                var location = gl.getAttribLocation(gl.program, name);
                gl.vertexAttrib3i(location, v0, v1, v2);
            },
            setAttribute4i: function setAttribute4i(name, v0, v1, v2, v3) {
                var location = gl.getAttribLocation(gl.program, name);
                gl.vertexAttrib4i(location, v0, v1, v2, v3);
            },


            /**
            * uniform
            * ----------------------------------------
            */

            // 浮点数
            setUniform1f: function setUniform1f(name, v0) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform1f(location, v0);
            },
            setUniform2f: function setUniform2f(name, v0, v1) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform2f(location, v0, v1);
            },
            setUniform3f: function setUniform3f(name, v0, v1, v2) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform3f(location, v0, v1, v2);
            },
            setUniform4f: function setUniform4f(name, v0, v1, v2, v3) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform4f(location, v0, v1, v2, v3);
            },


            // 整数
            setUniform1i: function setUniform1i(name, v0) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform1i(location, v0);
            },
            setUniform2i: function setUniform2i(name, v0, v1) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform2i(location, v0, v1);
            },
            setUniform3i: function setUniform3i(name, v0, v1, v2) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform3i(location, v0, v1, v2);
            },
            setUniform4i: function setUniform4i(name, v0, v1, v2, v3) {
                var location = gl.getUniformLocation(gl.program, name);
                gl.uniform4i(location, v0, v1, v2, v3);
            }
        };
    }

    function _painter(gl) {
        return {

            // 绘制点
            points: function points(first, count) {
                gl.drawArrays(gl.POINTS, first, count);
            },


            // 绘制直线
            lines: function lines(first, count) {
                gl.drawArrays(gl.LINES, first, count * 2);
            },


            // 绘制连续直线
            stripLines: function stripLines(first, count) {
                gl.drawArrays(gl.LINE_STRIP, first, count + 1);
            },


            // 绘制闭合直线
            loopLines: function loopLines(first, count) {
                gl.drawArrays(gl.LINE_LOOP, first, count);
            },


            // 绘制三角形
            triangles: function triangles(first, count) {
                gl.drawArrays(gl.TRIANGLES, first, count * 3);
            },


            // 绘制共有边三角形
            stripTriangles: function stripTriangles(first, count) {
                gl.drawArrays(gl.TRIANGLE_STRIP, first, count + 2);
            },


            // 绘制旋转围绕三角形
            fanTriangles: function fanTriangles(first, count) {
                gl.drawArrays(gl.TRIANGLE_FAN, first, count + 2);
            }
        };
    }

    // 获取webgl上下文
    var getCanvasWebgl = function getCanvasWebgl(node, opts) {
        var names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"],
            context = null,
            i = void 0;
        for (i = 0; i < names.length; i++) {
            try {
                context = node.getContext(names[i], opts);
            } catch (e) {}
            if (context) break;
        }
        return context;
    };

    // 绘图核心对象
    function core(node, opts) {
        var gl = getCanvasWebgl(node, opts),
            glObj = {

            // 画笔
            "painter": function painter() {
                return _painter(gl);
            },

            // 启用着色器
            "shader": function shader(vshaderSource, fshaderSource) {
                gl.program = useShader(gl, vshaderSource, fshaderSource);
                return glObj;
            },

            // 缓冲区
            "buffer": function buffer(isElement) {
                // 创建缓冲区
                newBuffer(gl, isElement);
                var bufferData = void 0,
                    bufferObj = {
                    // 写入数据
                    "write": function write(data, usage) {
                        usage = usage || gl.STATIC_DRAW;
                        writeBuffer(gl, data, usage, isElement);
                        bufferData = data;
                        return bufferObj;
                    },
                    // 分配使用
                    "use": function use(location, size, stride, offset, type, normalized) {
                        var fsize = bufferData.BYTES_PER_ELEMENT;
                        if (typeof location == 'string') location = gl.getAttribLocation(gl.program, location);
                        stride = stride || 0;
                        offset = offset || 0;
                        type = type || gl.FLOAT;
                        useBuffer(gl, location, size, type, stride * fsize, offset * fsize, normalized);
                        return bufferObj;
                    }
                };
                return bufferObj;
            },

            // 纹理
            "texture": function texture(unit, type) {
                type = {
                    "2d": gl.TEXTURE_2D,
                    "3d": gl.TEXTURE_3D,
                    "cube": gl.TEXTURE_CUBE_MAP
                }[type] || gl.TEXTURE_2D;
                // 创建纹理
                initTexture(gl, unit, type);
                var textureObj = {
                    // 配置纹理对象
                    "config": function config(_config) {
                        configTexture(gl, type, _config);
                        return textureObj;
                    },
                    // 链接图片资源
                    "use": function use(image, level, format, textureType) {
                        linkImage(gl, type, level, format, textureType, image);
                        return textureObj;
                    }
                };
                return textureObj;
            }

        };

        // attribue和uniform数据设置
        var valueMethods = value(gl);
        for (var key in valueMethods) {
            glObj[key] = valueMethods[key];
        }

        return glObj;
    }

    var image3D = function image3D() {};

    // 挂载3D核心启动器
    image3D.core = core;

    if ((typeof module === 'undefined' ? 'undefined' : _typeof(module)) === "object" && _typeof(module.exports) === "object") {
        module.exports = image3D;
    } else {
        var
        // 保存之前的image3D，防止直接覆盖
        _image3D = window.image3D;

        image3D.noConflict = function () {

            // 如果当前的$$是被最新的image3D覆盖的
            // 恢复之前的
            if (window.image3D === image3D) {
                window.image3D = _image3D;
            }

            // 返回当前image3D
            // 因为调用这个方法以后
            // 全局window下的image3D和$$是什么
            // 已经不一定了
            return image3D;
        };

        // 挂载对象到根
        window.image3D = image3D;
    }
})();