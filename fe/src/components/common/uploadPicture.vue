<template>
  <div>
    <el-upload
      class="upload-demo"
      ref="upload"
      multiple
      drag
      :action="''"
      :on-change="handleChange"
      :before-upload="beforeUpload"
      :on-success="handleSuccess"
      :on-error="handleError"
      :on-remove="handleRemove"
      :http-request="customUpload"
      :list-type="listType"
      :accept="accept"
      :limit="maxNumber"
      :auto-upload="false">
      <div class="el-upload__text">
        <svg viewBox="0 0 1024 1024" width="40" height="40">
          <path
            d="M666.2656 629.4528l-113.7664-112.4864c-20.7872-20.5824-54.3232-20.5312-75.1104 0.1024l-113.3056 112.4864c-20.8896 20.736-21.0432 54.528-0.256 75.4688 20.736 20.8896 54.528 21.0432 75.4688 0.256l22.6304-22.4256v189.5936c0 29.44 23.9104 53.3504 53.3504 53.3504s53.3504-23.9104 53.3504-53.3504v-189.5424l22.6816 22.4256a53.1456 53.1456 0 0 0 37.5296 15.4112c13.7728 0 27.4944-5.2736 37.9392-15.8208 20.6336-20.9408 20.4288-54.7328-0.512-75.4688z"
            fill="#FFE37B"></path>
          <path
            d="M820.992 469.504h-5.376c-3.072-163.328-136.3456-294.8096-300.4416-294.8096S217.856 306.1248 214.784 469.504H209.408c-100.7104 0-182.3744 81.664-182.3744 182.3744s81.664 182.3744 182.3744 182.3744h209.7664V761.856c-30.208 5.5808-62.464-3.3792-85.6576-26.7264-37.3248-37.5808-37.0688-98.5088 0.512-135.7824l113.3056-112.4864c37.2224-36.9664 97.8432-37.0176 135.168-0.1536l113.7664 112.4864c18.2272 18.0224 28.3648 42.0864 28.5184 67.7376 0.1536 25.6512-9.728 49.8176-27.7504 68.0448a95.40096 95.40096 0 0 1-68.3008 28.5184c-5.9392 0-11.776-0.512-17.5104-1.5872v72.3456h209.7664c100.7104 0 182.3744-81.664 182.3744-182.3744S921.7024 469.504 820.992 469.504z"
            fill="#8C7BFD"></path>
        </svg>
        <div>拖拽上传 / 点击上传</div>
      </div>
      <template v-if="listType === 'picture'">
        <div slot="tip" class="el-upload__tip">
          一次最多上传{{maxNumber}}张图片，且每张图片不超过{{maxSize}}M！
        </div>
      </template>
      <template v-else>
        <div slot="tip" class="el-upload__tip">
          一次最多上传{{maxNumber}}个文件，且每个文件不超过{{maxSize}}M！
        </div>
      </template>

    </el-upload>

    <!-- 从已上传的图库中选择（本项目新增） -->
    <div style="margin-top: 10px; display: flex; gap: 8px; align-items: center">
      <el-button size="small" icon="el-icon-picture-outline" @click="openGallery()">
        从图库选择
      </el-button>
      <span style="color: var(--greyFont); font-size: 12px">已有图片可直接复用，无需重复上传</span>
    </div>

    <el-dialog title="图库"
               :visible.sync="galleryVisible"
               width="70%"
               :append-to-body="true"
               destroy-on-close
               center>
      <div v-if="galleryLoading" style="text-align:center;padding:40px">
        <i class="el-icon-loading"></i> 加载中…
      </div>
      <div v-else-if="galleryList.length === 0" style="text-align:center;padding:40px;color:var(--greyFont)">
        图库里还没有图片，先上传一张吧
      </div>
      <div v-else class="gallery-grid">
        <div v-for="item in galleryList"
             :key="item.id"
             class="gallery-item"
             @click="pickFromGallery(item)">
          <el-image :src="item.path" fit="cover" class="gallery-thumb"></el-image>
          <div class="gallery-name">{{ item.originalName }}</div>
        </div>
      </div>
    </el-dialog>

    <div style="text-align: center;margin-top: 20px">
      <el-button type="success" style="font-size: 12px" @click="submitUpload">
        上传
      </el-button>
    </div>
  </div>
</template>

<script>
  import upload from '../../utils/ajaxUpload';

  export default {
    props: {
      isAdmin: {
        type: Boolean,
        default: false
      },
      prefix: {
        type: String,
        default: ""
      },
      listType: {
        type: String,
        default: "picture"
      },
      storeType: {
        type: String,
        /**
         * 后端没下发 defaultStoreType 时 localStorage 里是 null，
         * 直接显示会变成 "undefined"（存储平台那一列）。
         * 统一兜底到 b2（本项目实际用的后端）。
         */
        default: localStorage.getItem("defaultStoreType") || "b2"
      },
      accept: {
        type: String,
        default: "image/*"
      },
      maxSize: {
        type: Number,
        default: 5
      },
      maxNumber: {
        type: Number,
        default: 5
      }
    },

    data() {
      return {
        galleryVisible: false,
        galleryLoading: false,
        galleryList: []
      };
    },

    computed: {},

    watch: {},

    created() {
    },

    mounted() {

    },

    methods: {
      /** 打开图库，拉取已上传的图片 */
      openGallery() {
        this.galleryVisible = true;
        this.galleryLoading = true;
        this.galleryList = [];
        this.$http.post(this.$constant.baseURL + "/resource/listResource",
          { current: 1, size: 50, type: "picture" }, true)
          .then((res) => {
            const rows = (res.data && res.data.records) || [];
            // 只要图片类型的
            this.galleryList = rows.filter(r =>
              String(r.mimeType || '').includes('image') && r.path
            );
          })
          .catch(() => {
            this.$message({ message: '图库加载失败', type: 'error' });
          })
          .finally(() => { this.galleryLoading = false; });
      },

      /** 选中图库里的图，回传给父组件 */
      pickFromGallery(item) {
        this.galleryVisible = false;
        this.$emit('addPicture', item.path);
      },

      submitUpload() {
        this.$refs.upload.submit();
      },

      customUpload(options) {
        let suffix = "";
        if (options.file.name.lastIndexOf('.') !== -1) {
          suffix = options.file.name.substring(options.file.name.lastIndexOf('.'));
        }

        let key = this.prefix + "/" + (!this.$common.isEmpty(this.$store.state.currentUser.username) ? (this.$store.state.currentUser.username.replace(/[^a-zA-Z]/g, '') + this.$store.state.currentUser.id) : (this.$store.state.currentAdmin.username.replace(/[^a-zA-Z]/g, '') + this.$store.state.currentAdmin.id)) + new Date().getTime() + Math.floor(Math.random() * 1000) + suffix;

        /**
         * b2 / local 都走后端 /resource/upload。
         * 原代码只判断 local 和 qiniu，本项目默认 storeType 是 b2，
         * 落到 else 分支直接 return undefined —— 请求根本不发，
         * 表现为「点了上传没反应」。
         */
        if (this.storeType === "b2" || this.storeType === "local") {
          let fd = new FormData();
          fd.append("file", options.file);
          fd.append("originalName", options.file.name);
          fd.append("key", key);
          fd.append("relativePath", key);
          fd.append("type", this.prefix);
          fd.append("storeType", this.storeType);

          return this.$http.upload(this.$constant.baseURL + "/resource/upload", fd, this.isAdmin, options);
        } else if (this.storeType === "qiniu") {
          const xhr = new XMLHttpRequest();
          xhr.open('get', this.$constant.baseURL + "/qiniu/getUpToken?key=" + key, false);
          if (this.isAdmin) {
            xhr.setRequestHeader("Authorization", localStorage.getItem("adminToken"));
          } else {
            xhr.setRequestHeader("Authorization", localStorage.getItem("userToken"));
          }

          try {
            xhr.send();
            const res = JSON.parse(xhr.responseText);
            if (res !== null && res.hasOwnProperty("code") && res.code === 200) {
              options.data = {
                token: res.data,
                key: key
              };
              options.action = this.$store.state.sysConfig.qiniuUrl;
              return upload(options);
            } else if (res !== null && res.hasOwnProperty("code") && res.code !== 200) {
              return Promise.reject(res.message);
            } else {
              return Promise.reject("服务异常！");
            }
          } catch (e) {
            return Promise.reject(e.message);
          }
        }
      },

      // 文件上传成功时的钩子
      handleSuccess(response, file, fileList) {
        let url;
        if (this.storeType === "b2" || this.storeType === "local") {
          // 后端返回 { code, message, data: { path, url, key } }
          url = (response && response.data && (response.data.url || response.data.path)) || response.data;
        } else if (this.storeType === "qiniu") {
          url = this.$store.state.sysConfig['qiniu.downloadUrl'] + response.key;
          this.$common.saveResource(this, this.prefix, url, file.size, file.raw.type, file.name, "qiniu", this.isAdmin);
        }
        this.$emit("addPicture", url);
      },
      handleError(err, file, fileList) {
        this.$message({
          message: err,
          type: "error"
        });
      },
      // 上传文件之前的钩子，参数为上传的文件，若返回 false 或者返回 Promise 且被 reject，则停止上传
      beforeUpload(file) {
      },
      // 文件列表移除文件时的钩子
      handleRemove(file, fileList) {
      },
      // 添加文件、上传成功和上传失败时都会被调用
      handleChange(file, fileList) {
        let flag = false;

        if (file.size > this.maxSize * 1024 * 1024) {
          this.$message({
            message: "图片最大为" + this.maxSize + "M！",
            type: "warning"
          });
          flag = true;
        }

        if (flag) {
          fileList.splice(fileList.size - 1, 1);
        }
      }
    }
  }
</script>


<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
  padding: 4px;
}

.gallery-item {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--borderColor);
  transition: all 0.2s;
}

.gallery-item:hover {
  border-color: var(--themeBackground);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.gallery-thumb {
  width: 100%;
  height: 110px;
  display: block;
}

.gallery-name {
  font-size: 12px;
  padding: 6px;
  text-align: center;
  color: var(--greyFont);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
