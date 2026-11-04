<template>
  <div>
    <el-tag effect="dark" class="my-tag">
      <svg viewBox="0 0 1024 1024" width="20" height="20" style="vertical-align: -3px;">
        <path d="M0 0h1024v1024H0V0z" fill="#202425" opacity=".01"></path>
        <path
          d="M682.666667 204.8h238.933333a34.133333 34.133333 0 0 1 34.133333 34.133333v648.533334a68.266667 68.266667 0 0 1-68.266666 68.266666h-204.8V204.8z"
          fill="#FFAA44"></path>
        <path
          d="M68.266667 921.6a34.133333 34.133333 0 0 0 34.133333 34.133333h785.066667a68.266667 68.266667 0 0 1-68.266667-68.266666V102.4a34.133333 34.133333 0 0 0-34.133333-34.133333H102.4a34.133333 34.133333 0 0 0-34.133333 34.133333v819.2z"
          fill="#11AA66"></path>
        <path
          d="M238.933333 307.2a34.133333 34.133333 0 0 0 0 68.266667h136.533334a34.133333 34.133333 0 1 0 0-68.266667H238.933333z m0 204.8a34.133333 34.133333 0 1 0 0 68.266667h409.6a34.133333 34.133333 0 1 0 0-68.266667H238.933333z m0 204.8a34.133333 34.133333 0 1 0 0 68.266667h204.8a34.133333 34.133333 0 1 0 0-68.266667H238.933333z"
          fill="#FFFFFF"></path>
      </svg>
      文章信息
    </el-tag>
    <el-form :model="article" :rules="rules" ref="ruleForm" label-width="80px"
             class="demo-ruleForm">
      <el-form-item label="标题" prop="articleTitle">
        <el-input maxlength="30" v-model="article.articleTitle"></el-input>
      </el-form-item>

      <el-form-item label="视频链接" prop="videoUrl">
        <el-input maxlength="1000" v-model="article.videoUrl"></el-input>
      </el-form-item>

      <el-form-item label-width="auto" prop="articleContent">
        <mavon-editor ref="md" @imgAdd="imgAdd" v-model="article.articleContent"/>
      </el-form-item>

      <el-form-item label="启用评论" prop="commentStatus">
        <el-tag :type="article.commentStatus === false ? 'danger' : 'success'"
                disable-transitions>
          {{article.commentStatus === false ? '否' : '是'}}
        </el-tag>
        <el-switch v-model="article.commentStatus"></el-switch>
      </el-form-item>

      <el-form-item label="是否推荐" prop="recommendStatus">
        <el-tag :type="article.recommendStatus === false ? 'danger' : 'success'"
                disable-transitions>
          {{article.recommendStatus === false ? '否' : '是'}}
        </el-tag>
        <el-switch v-model="article.recommendStatus"></el-switch>
      </el-form-item>

      <el-form-item label="访问类型" prop="viewType">
        <el-select v-model="article.viewType" placeholder="访问类型" style="width: 120px">
          <el-option key="1" label="公开" value="public"></el-option>
          <el-option key="2" label="登录" value="login"></el-option>
          <el-option key="3" label="用户等级" value="userLv"></el-option>
          <el-option key="4" label="密码" value="password"></el-option>
        </el-select>
      </el-form-item>

      <el-form-item v-if="!$common.isEmpty(article.viewType) && article.viewType !== 'public' && article.viewType !== 'login'" label="访问条件" prop="viewValue">
        <template v-if="article.viewType === 'userLv'">
          <el-select v-model="article.viewValue" placeholder="用户等级" style="width: 120px">
            <el-option key="1" label="VIP1" value="1"></el-option>
            <el-option key="2" label="VIP2" value="2"></el-option>
            <el-option key="3" label="VIP3" value="3"></el-option>
            <el-option key="4" label="VIP4" value="4"></el-option>
            <el-option key="5" label="VIP5" value="5"></el-option>
            <el-option key="6" label="VIP6" value="6"></el-option>
          </el-select>
        </template>
        <template v-else-if="article.viewType === 'password'">
          <el-input maxlength="30" v-model="article.viewValue"></el-input>
        </template>
      </el-form-item>

      <el-form-item v-if="!$common.isEmpty(article.viewType) && article.viewType !== 'public' && article.viewType !== 'login'" label="提示" prop="tips">
        <el-input maxlength="100" v-model="article.tips"></el-input>
      </el-form-item>

      <el-form-item label="封面" prop="articleCover">
        <div style="display: flex">
          <el-input v-model="article.articleCover"></el-input>
          <el-image class="table-td-thumb"
                    lazy
                    style="margin-left: 10px"
                    :preview-src-list="[article.articleCover]"
                    :src="article.articleCover"
                    fit="cover"></el-image>
        </div>
        <uploadPicture :isAdmin="true" :prefix="'articleCover'" style="margin-top: 10px" @addPicture="addArticleCover"
                       :maxSize="2"
                       :maxNumber="1"></uploadPicture>
      </el-form-item>
      <el-form-item label="分类" prop="sortId">
        <el-select v-model="article.sortId" placeholder="请选择分类">
          <el-option
            v-for="item in sorts"
            :key="item.id"
            :label="item.sortName"
            :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="标签" prop="labelId">
        <el-select v-model="article.labelId" placeholder="请选择标签">
          <el-option
            v-for="item in labelsTemp"
            :key="item.id"
            :label="item.labelName"
            :value="item.id">
          </el-option>
        </el-select>
      </el-form-item>
    </el-form>
    <div class="myCenter" style="margin-bottom: 22px">
      <el-button type="primary" @click="submitForm('ruleForm')">保存</el-button>
      <el-button type="danger" @click="resetForm('ruleForm')">重置所有修改</el-button>
    </div>
  </div>
</template>

<script>
  const uploadPicture = () => import( "../common/uploadPicture");

  export default {
    components: {
      uploadPicture
    },
    data() {
      return {
        id: this.$route.query.id,
        article: {
          articleTitle: "",
          articleContent: "",
          commentStatus: true,
          recommendStatus: false,
          viewType: "",
          viewValue: "",
          tips: "",
          articleCover: "",
          videoUrl: "",
          sortId: null,
          labelId: null
        },
        sorts: [],
        labels: [],
        labelsTemp: [],
        rules: {
          articleTitle: [
            {required: true, message: '请输入标题', trigger: 'change'}
          ],
          articleContent: [
            {required: true, message: '请输入内容', trigger: 'change'}
          ],
          commentStatus: [
            {required: true, message: '是否启用评论', trigger: 'change'}
          ],
          recommendStatus: [
            {required: true, message: '是否推荐', trigger: 'change'}
          ],
          viewType: [
            {required: true, message: '访问类型', trigger: 'change'}
          ],
          articleCover: [
            {required: true, message: '封面', trigger: 'change'}
          ],
          sortId: [
            {required: true, message: '分类', trigger: 'change'}
          ],
          labelId: [
            {required: true, message: '标签', trigger: 'blur'}
          ]
        }
      }
    },

    computed: {},

    watch: {
      'article.sortId'(newVal, oldVal) {
        if (oldVal !== null) {
          this.article.labelId = null;
        }
        if (!this.$common.isEmpty(newVal) && !this.$common.isEmpty(this.labels)) {
          this.labelsTemp = this.labels.filter(l => l.sortId === newVal);
        }
      }
    },

    created() {
      this.getSortAndLabel();
    },

    mounted() {

    },

    methods: {
      imgAdd(pos, file) {
        let suffix = "";
        if (file.name.lastIndexOf('.') !== -1) {
          suffix = file.name.substring(file.name.lastIndexOf('.'));
        }
        let key = "articlePicture" + "/" + this.$store.state.currentAdmin.username.replace(/[^a-zA-Z]/g, '') + this.$store.state.currentAdmin.id + new Date().getTime() + Math.floor(Math.random() * 1000) + suffix;

        let storeType = localStorage.getItem("defaultStoreType") || "b2";

        let fd = new FormData();
        fd.append("file", file);
        fd.append("originalName", file.name);
        fd.append("key", key);
        fd.append("relativePath", key);
        fd.append("type", "articlePicture");
        fd.append("storeType", storeType);

        if (storeType === "local") {
          this.saveLocal(pos, fd);
        } else if (storeType === "qiniu") {
          this.saveQiniu(pos, fd);
        }
      },
      saveLocal(pos, fd) {
        this.$http.upload(this.$constant.baseURL + "/resource/upload", fd, true)
          .then((res) => {
            if (!this.$common.isEmpty(res.data)) {
              let url = res.data;
              this.$refs.md.$img2Url(pos, url);
            }
          })
          .catch((error) => {
            this.$message({
              message: error.message,
              type: "error"
            });
          });
      },
      saveQiniu(pos, fd) {
        this.$http.get(this.$constant.baseURL + "/qiniu/getUpToken", {key: fd.get("key")}, true)
          .then((res) => {
            if (!this.$common.isEmpty(res.data)) {
              fd.append("token", res.data);

              this.$http.uploadQiniu(this.$store.state.sysConfig.qiniuUrl, fd)
                .then((res) => {
                  if (!this.$common.isEmpty(res.key)) {
                    let url = this.$store.state.sysConfig['qiniu.downloadUrl'] + res.key;
                    let file = fd.get("file");
                    this.$common.saveResource(this, "articlePicture", url, file.size, file.type, file.name, "qiniu", true);
                    this.$refs.md.$img2Url(pos, url);
                  }
                })
                .catch((error) => {
                  this.$message({
                    message: error.message,
                    type: "error"
                  });
                });
            }
          })
          .catch((error) => {
            this.$message({
              message: error.message,
              type: "error"
            });
          });
      },
      addArticleCover(res) {
        this.article.articleCover = res;
      },
      getSortAndLabel() {
        this.$http.get(this.$constant.baseURL + "/webInfo/listSortAndLabel")
          .then((res) => {
            if (!this.$common.isEmpty(res.data)) {
              this.sorts = res.data.sorts;
              this.labels = res.data.labels;
              if (!this.$common.isEmpty(this.id)) {
                this.getArticle();
              }
            }
          })
          .catch((error) => {
            this.$message({
              message: error.message,
              type: "error"
            });
          });
      },
      getArticle() {
        this.$http.get(this.$constant.baseURL + "/admin/article/getArticleById", {id: this.id}, true)
          .then((res) => {
            if (!this.$common.isEmpty(res.data)) {
              this.article = res.data;
            }
          })
          .catch((error) => {
            this.$message({
              message: error.message,
              type: "error"
            });
          });
      },
      submitForm(formName) {
        if ((this.article.viewType === 'password' || this.article.viewType === 'userLv') &&
          this.$common.isEmpty(this.article.viewValue)) {
          this.$message({
            message: "请设置文章访问参数！",
            type: "error"
          });
          return;
        }
        this.$refs[formName].validate((valid) => {
          if (valid) {
            if (this.$common.isEmpty(this.id)) {
              this.saveArticle(this.article, "/article/saveArticle")
            } else {
              this.article.id = this.id;
              this.saveArticle(this.article, "/article/updateArticle")
            }
          } else {
            this.$message({
              message: "请完善必填项！",
              type: "error"
            });
          }
        });
      },
      resetForm(formName) {
        this.$refs[formName].resetFields();
        if (!this.$common.isEmpty(this.id)) {
          this.getArticle();
        }
      },
      saveArticle(value, url) {
        this.$confirm('确认保存？', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'success',
          center: true
        }).then(() => {
          this.$http.post(this.$constant.baseURL + url, value, true)
            .then((res) => {
              this.$message({
                message: "保存成功！",
                type: "success"
              });
              this.$router.push({path: '/postList'});
            })
            .catch((error) => {
              this.$message({
                message: error.message,
                type: "error"
              });
            });
        }).catch(() => {
          this.$message({
            type: 'success',
            message: '已取消保存!'
          });
        });
      }
    }
  }
</script>

<style scoped>

  .my-tag {
    margin-bottom: 20px;
    width: 100%;
    text-align: left;
    background: var(--lightYellow);
    border: none;
    height: 40px;
    line-height: 40px;
    font-size: 16px;
    color: var(--black);
  }

  .table-td-thumb {
    border-radius: 2px;
    width: 40px;
    height: 40px;
  }

  .el-switch {
    margin-left: 10px;
  }

  .el-form-item {
    margin-bottom: 40px;
  }
</style>
