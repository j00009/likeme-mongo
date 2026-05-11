let usuarioLogueado = JSON.parse(
    localStorage.getItem('usuario')
) || null;
const postsContainer = document.querySelector('.posts');

const API_URL = 'http://localhost:3001';

// TEMPLATE CARD

const crearCard = (post) => {

    return `
    
        <div class="col-12 col-md-6 col-lg-4">

            <div class="post-card">

                <div class="post-header">

                    <div>

                        <div class="post-user">
                            <i class="bi bi-person-circle"></i>
                            ${post.usuario}
                        </div>

                        <div class="post-date">
                            ${new Date(post.fecha).toLocaleDateString()}
                        </div>

                    </div>

                    ${
                        usuarioLogueado &&
                        usuarioLogueado.id === post.usuarioId
                     ? `

                    <div class="d-flex gap-2">

                        <button
                            class="btn btn-sm btn-warning"
                            onclick='abrirEditar(${JSON.stringify(post)})'>

                            <i class="bi bi-pencil"></i>
                        </button>

                        <button
                            class="btn btn-sm btn-danger"
                            onclick="eliminarPost('${post.id}')">

                            <i class="bi bi-trash"></i>
                        </button>

                    </div>

                `
                : ''
        }

                </div>

                <img
                    src="${post.url}"
                    class="post-img"
                    alt="post">

                <div class="post-body">

                    <div class="descripcion">
                        ${post.descripcion || ''}
                    </div>

                    <div class="post-actions">

                        <button
                            class="like-btn"
                            onclick="darLike('${post.id}')">

                            <i class="bi bi-heart-fill"></i>
                        </button>

                        <span class="likes">
                            ${post.likes} likes
                        </span>

                    </div>

                    <!-- COMENTARIOS -->

                    <div class="comentarios-preview mt-3">

    ${post.comentarios?.slice(0, 2).map(comentario => `

        <div class="comentario-item">

            <strong>
                ${comentario.usuario}
            </strong>

            ${comentario.texto}

        </div>

    `).join('')}

    ${post.comentarios?.length > 2
            ? `
                <button
                    class="btn btn-sm btn-link"
                    onclick='verComentarios(${JSON.stringify(post)})'>

                    Ver todos los comentarios
                </button>
              `
            : ''
        }
</div>
                    </div>

                    <!-- INPUT COMENTARIO -->

                    <div class="comentario-box mt-3">

                        <input
                            id="comentario-${post.id}"
                            type="text"
                            class="form-control"
                            placeholder="Escribe un comentario">

                        <button
                            class="btn btn-sm btn-primary mt-2"
                            onclick="comentarPost('${post.id}')">

                            Comentar
                        </button>

                    </div>

                </div>

            </div>

        </div>
    `;
};

// CARGAR POSTS

const cargarPosts = async () => {

    try {

        const response = await axios.get(`${API_URL}/posts`);

        const posts = response.data;

        postsContainer.innerHTML = '';

        posts.forEach(post => {

            postsContainer.innerHTML += crearCard(post);

        });

    } catch (error) {

        console.log(error);

    }
};



// CREAR POST

const formPost = document.getElementById('formPost');

formPost.addEventListener('submit', async (e) => {

    e.preventDefault();

    const usuario = document.getElementById('usuario').value;

    const url = document.getElementById('url').value;

    const descripcion = document.getElementById('descripcion').value;

    const payload = {
        usuario: usuarioLogueado.nombre,
        usuarioId: usuarioLogueado.id,
        url,
        descripcion
    };

    try {

        await axios.post(`${API_URL}/post`, payload);

        formPost.reset();

        const modalElement = document.getElementById('modalPost');

        const modal = bootstrap.Modal.getInstance(modalElement);

        modal.hide();

        cargarPosts();

    } catch (error) {

        console.log(error);

    }

});



// LIKE

const darLike = async (id) => {

    try {

        await axios.put(`${API_URL}/post?id=${id}`);

        cargarPosts();

    } catch (error) {

        console.log(error);

    }

};



// ELIMINAR

const eliminarPost = async (id) => {

    try {

        await axios.delete(`${API_URL}/post-eliminar?id=${id}`);

        cargarPosts();

    } catch (error) {

        console.log(error);

    }

};



// MIS POSTS

const misPosts = async () => {

    if (!usuarioLogueado) {

        alert('Debes iniciar sesión');

        return;
    }

    try {

        const response = await axios.get(`${API_URL}/posts`);

        const posts = response.data;

        const filtrados = posts.filter(post =>
            post.usuarioId === usuarioLogueado.id
        );

        postsContainer.innerHTML = '';

        filtrados.forEach(post => {

            postsContainer.innerHTML += crearCard(post);

        });

    } catch (error) {

        console.log(error);

    }

};

// INICIAR

cargarPosts();

const usuarioActual = document.getElementById('usuarioActual');

if (usuarioLogueado) {

    usuarioActual.innerHTML = `

        <span class="text-white">
            <i class="bi bi-person-circle"></i>
            ${usuarioLogueado.nombre}
        </span>

        <button
            class="btn btn-danger btn-sm"
            onclick="logout()">

            Salir
        </button>
    `;

} else {

    usuarioActual.innerHTML = `
    
        <button
            class="btn btn-light"
            data-bs-toggle="modal"
            data-bs-target="#loginModal">

            Login
        </button>
    `;
}

const logout = () => {

    localStorage.removeItem('usuario');

    location.reload();
};

const formRegistro = document.getElementById('formRegistro');

formRegistro.addEventListener('submit', async (e) => {

    e.preventDefault();

    const payload = {
        nombre: document.getElementById('registroNombre').value,
        email: document.getElementById('registroEmail').value,
        password: document.getElementById('registroPassword').value
    };

    try {

        await axios.post(`${API_URL}/registro`, payload);

        const registroModal = bootstrap.Modal.getInstance(
    document.getElementById('registroModal')
);

registroModal.hide();

const loginModal = new bootstrap.Modal(
    document.getElementById('loginModal')
);

loginModal.show();

formRegistro.reset();

    } catch (error) {

        console.log(error);

    }
});

const formLogin = document.getElementById('formLogin');

formLogin.addEventListener('submit', async (e) => {

    e.preventDefault();

    const payload = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };

    try {

        const response = await axios.post(
            `${API_URL}/login`,
            payload
        );

        localStorage.setItem(
            'usuario',
            JSON.stringify(response.data)
        );

        location.reload();

    } catch (error) {

        alert('Credenciales incorrectas');

    }
});

const comentarPost = async (id) => {

    if (!usuarioLogueado) {

        alert('Debes iniciar sesión');

        return;
    }

    const input = document.getElementById(
        `comentario-${id}`
    );

    const texto = input.value;

    if (!texto.trim()) return;

    try {

        await axios.post(

            `${API_URL}/comentario/${id}`,

            {
                usuario: usuarioLogueado.nombre,
                texto
            }
        );

        cargarPosts();

    } catch (error) {

        console.log(error);

    }

};
const verComentarios = (post) => {

    const container = document.getElementById(
        'comentariosContainer'
    );

    container.innerHTML = '';

    post.comentarios.forEach(comentario => {

        container.innerHTML += `

            <div class="mb-3">

                <strong>
                    ${comentario.usuario}
                </strong>

                <div>
                    ${comentario.texto}
                </div>

            </div>
        `;
    });

    const modal = new bootstrap.Modal(
        document.getElementById('comentariosModal')
    );

    modal.show();
};

const abrirEditar = (post) => {

    document.getElementById('editPostId').value =
        post.id;

    document.getElementById('editUrl').value =
        post.url;

    document.getElementById('editDescripcion').value =
        post.descripcion;

    const modal = new bootstrap.Modal(
        document.getElementById('editarModal')
    );

    modal.show();
};

const formEditar =
    document.getElementById('formEditar');

formEditar.addEventListener('submit', async (e) => {

    e.preventDefault();

    const id =
        document.getElementById('editPostId').value;

    const url =
        document.getElementById('editUrl').value;

    const descripcion =
        document.getElementById('editDescripcion').value;

    try {

        await axios.put(

            `${API_URL}/editar-post/${id}`,

            {
                url,
                descripcion
            }
        );

        const modal = bootstrap.Modal.getInstance(
            document.getElementById('editarModal')
        );

        modal.hide();

        cargarPosts();

    } catch (error) {

        console.log(error);

    }

});