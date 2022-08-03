// ----------------------- HELPERS -----------------
function createElement(tag, parent, classLists, attrs = null, text = null) {
    const el = document.createElement(tag);
    parent && parent.appendChild(el);

    if(classLists) {
        for (const classList of classLists) {
            el.classList.add(classList);
        }
    }

    if (attrs) {
        for (const attr of attrs) {
            el.setAttribute(attr.type, attr.value);
        }
    }

    if(text) {
        el.innerText = text;
    }

    return el;
}

// ----------------------- STORAGE -----------------

class Storage {
    constructor () {
        this.baseUrl = 'https://todo.hillel.it';
        this.token = '';
        this.headers ='';
    }

    async request(url, method = 'GET', body = null, headers = this.headers) {
        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: body
        });

        if(response.ok) {
            const result = await response.json();
            return result;
        } else {
            throw new Error(`${response.status}. Произошла ошибка! Попробуйте снова.`);
        }
    }

    async getAllFromStorage() {

        const headers = new Headers();
        headers.set('Authorization', `Bearer ${this.token}`);
        headers.set('Content-Type', 'application/json');
        this.headers = headers;

        return await this.request(`${this.baseUrl}/todo`);
    }

    async auth(email = null, password = null) {
        const ref = localStorage.getItem('authToken');

        if (ref) {
            this.token = ref;
        } else {
            const url = `${this.baseUrl}/auth/login`;
            const method = 'POST';
            const headers = new Headers();
            headers.set('Content-Type', 'application/json');
            const authValue = `${email}${password}`;
            const requestBody = JSON.stringify({ value: authValue });

            const {access_token: accessToken} = await this.request(url, method, requestBody, headers);
            this.token = accessToken;
            localStorage.setItem('authToken', this.token);
        }
        return await this.getAllFromStorage();
    }

    async addTask(value, priority) {
        const requestBody = JSON.stringify({
            value,
            priority: Number(priority)
        });
        return await this.request(`${this.baseUrl}/todo`, 'POST', requestBody);
    }

    async removeTask(id) {
        await this.request(`${this.baseUrl}/todo/${id}`, 'DELETE');
    }

    async editTask(id, textEdited, priority) {
        const requestBody = JSON.stringify({
            value: textEdited,
            priority: Number(priority)
        });
        await this.request(`${this.baseUrl}/todo/${id}`, 'PUT', requestBody);
    }

    async toggleState(id) {
        await this.request(`${this.baseUrl}/todo/${id}/toggle`, 'PUT');
    }
}

// ------------- ToDoList Model -------------

class ToDoListModel {
    constructor (storage) {
        this.tasks = [];
        this.storage = storage;
    }

    async login(email = null, password = null) {
        const response = await this.storage.auth(email, password);
        this.tasks = response;
    }

    async addTask(value, priority) {
        const isUinque = !this.tasks.find(item => item.value === value);

        if (isUinque) {
            const response = await this.storage.addTask(value, priority);
            this.tasks.push(response);
        }
    }

    async removeTask(id) {
        await this.storage.removeTask(id);
        this.tasks = this.tasks.filter(({ _id }) => _id !== Number(id));
    }

    async editTask(id, textEdited, priority) {
        const editIndex = this.tasks.findIndex(item => item._id === Number(id));
        const notFoundIndex = -1;

        if (editIndex === notFoundIndex) return;

        const isEmpty = !textEdited;
        const tasksWithoutEdited = this.tasks.filter(item => item._id !== Number(id));
        const isUinque = !tasksWithoutEdited.find(item => item.value === textEdited);

        if(!isEmpty && isUinque) {
            await this.storage.editTask(id, textEdited, priority);
            this.tasks[editIndex].value = textEdited;
            this.tasks[editIndex].priority = priority;
        }
    }

    async toggleState(id) {
        const index = this.tasks.findIndex(item => item._id === Number(id));
        const notFoundIndex = -1;

        if (index!== notFoundIndex) {
            await this.storage.toggleState(id);
            this.tasks[index].checked = !this.tasks[index].checked;
        }
    }

    getStatisctics() {
        return this.tasks.reduce((accum, item) => {
            item.checked ? accum.completed++ : accum.active++;
            return accum;
        }, {
            active: 0,
            completed: 0,
            total: this.tasks.length
        });
    }
}

Object.defineProperties(ToDoListModel.prototype, {
    addTask: {configurable: false},
    deleteTask: {configurable: false},
    editTask: {configurable: false},
    toggleState: {configurable: false},
    getStatisctics: {configurable: false},
    login: {configurable: false}
});


class TodoListView {
    constructor (listModel) {
        this.listModel = listModel;
        this.loginForm = document.querySelector('.login-form');
        this.logoutBtn = document.querySelector('.logout-btn');
        this.addForm = document.querySelector('.add-form');
        this.list = document.querySelector('.list');
        this.hideBtn = document.querySelector('.to-dos__hide-btn');

        this.addPreloader = async function(el, fn, isDisabled = false, toggleClassLists = null) {
            el.classList.add('loading');

            if(isDisabled) {
                el.setAttribute('disabled', '');
            }

            if(toggleClassLists) {
                for(const toggleClassList of toggleClassLists) {
                    el.classList.remove(toggleClassList);
                }
            }

            try {
                await fn();
            } catch (error) {
                alert(error);
            }

            el.classList.remove('loading');

            if(isDisabled) {
                el.removeAttribute('disabled', '');
            }

            if(toggleClassLists) {
                for(const toggleClassList in toggleClassLists) {
                    el.classList.add(toggleClassList);
                }
            }
        };

        this.login();
        this.logout();
        this.initSubmit();
        this.initRemove();
        this.initToogleState();
        this.initStatistics();
        this.initEdit();
        this.hideCompleted();
    }

    async login() {
        const authSection = document.querySelector('.auth');
        const toDoSection = document.querySelector('.todo-form');
        const ref = localStorage.getItem('authToken');

        if (ref) {
            try {
                await this.listModel.login();
                this.renderToDoList();
                toDoSection.classList.remove('hidden');
            } catch (err) {
                alert(err);
            }
        } else {
            authSection.classList.remove('hidden');
            this.loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = new FormData(e.target);
                const email = data.get('email');
                const password = data.get('password');

                if (email && password) {
                    const login = async () => {
                        await this.listModel.login(email, password);
                        this.renderToDoList();
                        authSection.classList.add('hidden');
                        toDoSection.classList.remove('hidden');
                    };
                    this.addPreloader(e.submitter, login, true);
                }
            });
        }
    }

    logout() {
        this.logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            document.location.reload();
        });
    }

    renderToDoList(){
        this.list.innerHTML = '';
        if (!this.listModel.tasks.length) return;

        const fragment = new DocumentFragment;

        for (const toDoItem of this.listModel.tasks) {
            const li = createElement('li', fragment, ['list-item', `priority-${toDoItem.priority}`],
                [{type:'data-id', value: `${toDoItem._id}`}]);

            const text = createElement('p', li, ['list-item__text'], null, `${toDoItem.value}`);
            const checkboxWrap = createElement('div', li, ['list-item__state']);
            const checkbox = createElement('input', checkboxWrap, ['list-item__checkbox'],
                [{type: 'type', value: 'checkbox'}]);

            createElement('div', checkboxWrap, ['preloader']);

            li.insertAdjacentHTML('beforeend',
                `<button type="button" class="button list-item__edit fa-solid fa-pen-to-square"></button>
                <button type="button" class="button list-item__delete fa-solid fa-xmark">
                <div class="preloader"></div></button>`);

            if (toDoItem.checked) {
                li.classList.add('list-item_completed');
                text.classList.add('list-item__text_completed');
                checkbox.setAttribute('checked', '');
            }
        }

        this.list.append(fragment);
        const statBtn = document.querySelector('.statistics-btn');
        statBtn.classList.remove('hidden');

        const todosBlock = document.querySelector('.to-dos');
        todosBlock.classList.remove('hidden');
    }

    initSubmit() {
        this.addForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = new FormData(e.target);
            const text = data.get('text').trim();
            const priority = data.get('priority');

            if (text && priority) {
                const submit = async () => {
                    await this.listModel.addTask(text, priority);
                    this.renderToDoList();
                };
                this.addPreloader(e.submitter, submit, true);
                e.target.reset();
            }
        });
    }

    initRemove (){
        this.list.addEventListener('click', async ({target}) => {
            if (!target.classList.contains('list-item__delete')) return;

            const deleteItem = target.closest('[data-id]');
            const id = deleteItem.getAttribute('data-id');

            if (id) {
                const remove = async () => {
                    await this.listModel.removeTask(id);
                    this.renderToDoList();
                };
                this.addPreloader(target, remove, true, ['fa-solid', 'fa-xmark']);
            }
        });
    }

    initToogleState() {
        this.list.addEventListener('change', async ({target}) => {
            if (!target.classList.contains('list-item__checkbox')) return;

            const toggleItem = target.closest('[data-id]');
            const id = toggleItem.getAttribute('data-id');
            const toggleItemText = document.querySelector(`li[data-id="${id}"] .list-item__text`);

            if (id) {
                const toggle = async () => {
                    await this.listModel.toggleState(id);
                    toggleItemText.classList.toggle('list-item__text_completed');
                    toggleItem.classList.toggle('list-item_completed');
                };
                this.addPreloader(target.closest('.list-item__state'), toggle);
            }
        });
    }

    initEdit() {
        this.list.addEventListener('click', ({target}) => {
            if (!target.classList.contains('list-item__edit')) return;

            target.style.display = 'none';

            const editItem = target.closest('[data-id]');
            const id = editItem.getAttribute('data-id');

            if (!id) return;

            const task = document.querySelector(`li[data-id="${id}"]`);
            const taskText = document.querySelector(`li[data-id="${id}"] .list-item__text`);
            const taskInnerText = taskText.innerText;
            const fragment = new DocumentFragment;

            const editForm = createElement('form', fragment, ['edit-form'], [{type: 'name', value: 'editForm'}]);
            createElement('input', editForm, ['input', 'edit-form__text'],
                [{type: 'type', value: 'text'}, {type: 'name', value: 'text'},
                    {type: 'value', value: `${taskInnerText}`}]);

            const priority = createElement('select', editForm, ['select', 'edit-form__select'],
                [{type: 'name', value: 'priority'}]);

            createElement('option', priority, ['priority__item'],
                [{type: 'disabled', value: ''}, {type: 'value', value: 'Choose priority'}], 'Choose priority');

            const priorityCount = 3;

            for(let i = 1; i <= priorityCount; i++) {
                const priorityOption = createElement('option', priority, ['priority__item'],
                    [{type: 'value', value: i}, ], i);

                if (task.classList.contains(`priority-${i}`)) {
                    priorityOption.setAttribute('selected','');
                }
            }

            const submit = createElement('button', editForm, ['button', 'edit-form__save']);
            createElement('span', submit, null, null, 'Save');
            createElement('div', submit, ['preloader']);
            createElement('button', editForm, ['button', 'edit-form__cancel'], null, 'Cancel');

            fragment.append(editForm);
            taskText.classList.add('hidden');
            task.prepend(fragment);

            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const data = new FormData(e.target);
                const textEdited = data.get('text').trim();
                const priorityEdited = data.get('priority');

                if (e.submitter.classList.contains('edit-form__save') && textEdited && priorityEdited) {
                    const edit = async () => {
                        await this.listModel.editTask(id, textEdited, priorityEdited);
                        this.renderToDoList();
                    };
                    this.addPreloader(e.submitter, edit, true);
                } else if (e.submitter.classList.contains('edit-form__cancel') || !textEdited) {
                    this.renderToDoList();
                }
            });
        });
    }

    initStatistics() {
        const statistics = document.querySelector('.statistics-btn');
        const activeTasks = document.querySelector('.statistics-list__active');
        const completedTasks = document.querySelector('.statistics-list__completed');
        const totalTasks = document.querySelector('.statistics-list__total');
        const statisticsList = document.querySelector('.statistics-list');

        statistics.addEventListener('click', () => {
            statisticsList.classList.toggle('hidden');
            const result = this.listModel.getStatisctics();
            const {active, completed, total} = result;
            activeTasks.innerText = `Active tasks: ${active}`;
            completedTasks.innerText = `Completed tasks: ${completed}`;
            totalTasks.innerText = `Total: ${total}`;
        });

        statistics.addEventListener('blur', () => {
            statisticsList.classList.add('hidden');
        });
    }

    hideCompleted() {
        this.hideBtn.addEventListener('click', () => {
            const completedItems = document.querySelectorAll('.list-item_completed');
            if (this.hideBtn.innerText === 'Hide completed') {
                this.hideBtn.innerText = 'Show completed';

                for (const item of completedItems) {
                    item.classList.add('hidden');
                }

            } else {
                this.hideBtn.innerText = 'Hide completed';

                for (const item of completedItems) {
                    item.classList.remove('hidden');
                }
            }
        });
    }

}
// eslint-disable-next-line no-unused-vars
const toDo = new TodoListView(new ToDoListModel(new Storage) );