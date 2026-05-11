const api = {
  posts: "/api/posts",
  comments: "/api/comments",
};

const state = {
  posts: [],
  loading: false,
  pendingDeleteId: null,
};

const elements = {
  postForm: document.querySelector("#post-form"),
  posts: document.querySelector("#posts"),
  empty: document.querySelector("#empty-state"),
  loading: document.querySelector("#loading-state"),
  feedStatus: document.querySelector("#feed-status"),
  toastContainer: document.querySelector("#toast-container"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  editDialog: document.querySelector("#edit-dialog"),
  editForm: document.querySelector("#edit-form"),
  totals: {
    posts: document.querySelector("#total-posts"),
    likes: document.querySelector("#total-likes"),
    comments: document.querySelector("#total-comments"),
  },
};

const escapeHtml = (value = "") => {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
};

const formatDate = (date) => {
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const setLoading = (loading) => {
  state.loading = loading;
  elements.loading.hidden = !loading;
  elements.feedStatus.textContent = loading ? "Cargando..." : "Sincronizado";
};

const notify = (message, type = "success") => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${type === "error" ? "bi-exclamation-circle" : "bi-check-circle"}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  elements.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3600);
};

const getErrorMessage = (error, fallback) => {
  return error.response?.data?.error || fallback;
};

const renderStats = () => {
  const totalLikes = state.posts.reduce((total, post) => total + (post.likes || 0), 0);
  const totalComments = state.posts.reduce((total, post) => total + (post.comentarios?.length || 0), 0);

  elements.totals.posts.textContent = state.posts.length;
  elements.totals.likes.textContent = totalLikes;
  elements.totals.comments.textContent = totalComments;
};

const commentTemplate = (comment) => `
  <li class="comment-item">
    <img src="${escapeHtml(comment.avatar || comment.autor?.avatar || "")}" alt="" class="mini-avatar">
    <div>
      <strong>${escapeHtml(comment.usuario || comment.autorNombre || "Usuario")}</strong>
      <p>${escapeHtml(comment.texto)}</p>
      <time>${formatDate(comment.createdAt)}</time>
    </div>
    <button class="comment-delete" type="button" data-action="delete-comment" data-id="${comment.id}" title="Eliminar comentario">
      <i class="bi bi-x-lg"></i>
    </button>
  </li>
`;

const postTemplate = (post) => {
  const comments = post.comentarios || [];
  const avatar = post.avatar || post.autor?.avatar || "";
  const user = post.usuario || post.autorNombre || "Usuario";

  return `
    <article class="post-card" data-post-id="${post.id}">
      <header class="post-header">
        <div class="post-author">
          <img src="${escapeHtml(avatar)}" alt="" class="avatar">
          <div>
            <h3>${escapeHtml(user)}</h3>
            <time>${formatDate(post.createdAt || Date.now())}</time>
          </div>
        </div>
        <div class="post-menu">
          <button class="icon-button soft" type="button" data-action="edit" data-id="${post.id}" title="Editar">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="icon-button danger-soft" type="button" data-action="delete" data-id="${post.id}" title="Eliminar">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </header>

      <img class="post-image" src="${escapeHtml(post.url)}" alt="${escapeHtml(post.descripcion)}">

      <div class="post-content">
        <p>${escapeHtml(post.descripcion)}</p>
        <div class="post-actions">
          <button class="like-button" type="button" data-action="like" data-id="${post.id}">
            <i class="bi bi-heart-fill"></i>
            <span>${post.likes || 0}</span>
          </button>
          <span class="comment-count">
            <i class="bi bi-chat-dots"></i>
            ${comments.length}
          </span>
        </div>
      </div>

      <section class="comments">
        <ul>${comments.map(commentTemplate).join("")}</ul>
        <form class="comment-form" data-post-id="${post.id}">
          <input name="usuario" type="text" placeholder="Tu nombre" required minlength="2">
          <input name="texto" type="text" placeholder="Escribe un comentario" required maxlength="180">
          <button type="submit" title="Comentar">
            <i class="bi bi-send"></i>
          </button>
        </form>
      </section>
    </article>
  `;
};

const renderPosts = () => {
  elements.posts.innerHTML = state.posts.map(postTemplate).join("");
  elements.empty.hidden = state.posts.length > 0 || state.loading;
  renderStats();
};

const loadPosts = async () => {
  setLoading(true);

  try {
    const { data } = await axios.get(api.posts);
    state.posts = data;
    renderPosts();
  } catch (error) {
    notify(getErrorMessage(error, "No se pudieron cargar los posts"), "error");
  } finally {
    setLoading(false);
    renderPosts();
  }
};

const createPost = async (event) => {
  event.preventDefault();

  const button = event.target.querySelector("button[type='submit']");
  button.disabled = true;
  button.querySelector("span").textContent = "Publicando...";

  const payload = {
    usuario: document.querySelector("#post-user").value.trim(),
    email: document.querySelector("#post-email").value.trim(),
    URL: document.querySelector("#post-url").value.trim(),
    descripcion: document.querySelector("#post-description").value.trim(),
  };

  try {
    const { data } = await axios.post(api.posts, payload);
    state.posts = [data, ...state.posts];
    event.target.reset();
    renderPosts();
    notify("Publicacion creada");
  } catch (error) {
    notify(getErrorMessage(error, "No se pudo crear el post"), "error");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "Crear publicacion";
  }
};

const likePost = async (id) => {
  try {
    const { data } = await axios.patch(`${api.posts}/${id}/like`);
    state.posts = state.posts.map((post) => post.id === id ? data : post);
    renderPosts();
  } catch (error) {
    notify(getErrorMessage(error, "No se pudo dar like"), "error");
  }
};

const openDeleteDialog = (id) => {
  state.pendingDeleteId = id;
  elements.confirmDialog.hidden = false;
};

const closeDeleteDialog = () => {
  state.pendingDeleteId = null;
  elements.confirmDialog.hidden = true;
};

const deletePost = async () => {
  if (!state.pendingDeleteId) return;

  try {
    await axios.delete(`${api.posts}/${state.pendingDeleteId}`);
    state.posts = state.posts.filter((post) => post.id !== state.pendingDeleteId);
    renderPosts();
    notify("Publicacion eliminada");
  } catch (error) {
    notify(getErrorMessage(error, "No se pudo eliminar el post"), "error");
  } finally {
    closeDeleteDialog();
  }
};

const openEditDialog = (id) => {
  const post = state.posts.find((item) => item.id === id);
  if (!post) return;

  document.querySelector("#edit-id").value = post.id;
  document.querySelector("#edit-user").value = post.usuario || post.autorNombre;
  document.querySelector("#edit-url").value = post.url;
  document.querySelector("#edit-description").value = post.descripcion;
  elements.editDialog.hidden = false;
};

const closeEditDialog = () => {
  elements.editDialog.hidden = true;
  elements.editForm.reset();
};

const updatePost = async (event) => {
  event.preventDefault();

  const id = document.querySelector("#edit-id").value;
  const payload = {
    usuario: document.querySelector("#edit-user").value.trim(),
    url: document.querySelector("#edit-url").value.trim(),
    descripcion: document.querySelector("#edit-description").value.trim(),
  };

  try {
    const { data } = await axios.put(`${api.posts}/${id}`, payload);
    state.posts = state.posts.map((post) => post.id === id ? data : post);
    renderPosts();
    closeEditDialog();
    notify("Publicacion actualizada");
  } catch (error) {
    notify(getErrorMessage(error, "No se pudo actualizar el post"), "error");
  }
};

const createComment = async (event) => {
  event.preventDefault();

  const form = event.target;
  const payload = {
    post: form.dataset.postId,
    usuario: form.usuario.value.trim(),
    texto: form.texto.value.trim(),
  };

  try {
    await axios.post(api.comments, payload);
    form.reset();
    await loadPosts();
    notify("Comentario agregado");
  } catch (error) {
    notify(getErrorMessage(error, "No se pudo crear el comentario"), "error");
  }
};

const deleteComment = async (id) => {
  try {
    await axios.delete(`${api.comments}/${id}`);
    await loadPosts();
    notify("Comentario eliminado");
  } catch (error) {
    notify(getErrorMessage(error, "No se pudo eliminar el comentario"), "error");
  }
};

elements.postForm.addEventListener("submit", createPost);
elements.editForm.addEventListener("submit", updatePost);

document.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-action]");
  const confirmButton = event.target.closest("[data-confirm]");
  const editButton = event.target.closest("[data-edit]");

  if (actionButton) {
    const { action, id } = actionButton.dataset;
    if (action === "like") likePost(id);
    if (action === "delete") openDeleteDialog(id);
    if (action === "edit") openEditDialog(id);
    if (action === "refresh") loadPosts();
    if (action === "focus-composer") document.querySelector("#post-user").focus();
    if (action === "delete-comment") deleteComment(id);
  }

  if (confirmButton) {
    if (confirmButton.dataset.confirm === "accept") deletePost();
    if (confirmButton.dataset.confirm === "cancel") closeDeleteDialog();
  }

  if (editButton && editButton.dataset.edit === "cancel") {
    closeEditDialog();
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.matches(".comment-form")) {
    createComment(event);
  }
});

loadPosts();
