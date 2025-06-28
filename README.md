CT Scheduling

Requirements
For development, you will need node.js for the frontend and python for the backend.

Node
Node is easy to install and includes npm. The following commands should run after installation.
$ node --version
v20.2.0
$ npm --version
v9.6.7

Node installation on OS X
You will need to use a Terminal. On OS X, you can find the default terminal in /Applications/Utilities/Terminal.app.

Please install Homebrew if it's not already done with the following command.

/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

If everything when fine, you should run

$ brew install node

Node installation on Linux

$ sudo apt-get install nodejs
$ sudo apt-get install npm

Node installation on Windows
Go to the official Node.js website, download the installer, and run it. Make sure you have git available in your PATH, npm may need it.

Install
$ git clone https://github.com/gtchiudi/ct-scheduling
$ cd ct-scheduling
$ npm install

Start:
$ npm run dev

Updating Sources:
As packages may change frequently, update by running the following
$ git pull
$ npm prune
$ npm install

Python
Check version with
$ python3 --version or $ python --version
Python 3.11.3

Mac OS X
Install python3 using homebrew

$ brew install python3

Linux
To install python3 using the linux terminal, run

$ sudo apt-get update
$ sudo apt-get install python 3.11

Windows
Download the installer from the official Python website and get the lastest installer for Python 3.x for Windows. Run the installer and verify the version.

The server for this application requires Django.
Consider installing in a python virtual environment.

Once a virtual environment is created and activated, run
$ python3 -m pip install Django

To install python packages, run:
$ pip install -r /ct-scheduling/server/requirements.txt

To activate the server, run
$ cd server
$ python3 manage.py runserver

To build, first bump version in frontend/package.json
$ ./build.sh

To deploy, first update the image tag in deployments/base/.replacements
$ kubectl diff -k deployments/production # show what changes will be applied
$ kubectl apply -k deployments/production

To initialize kubenetes cluster
$ kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.11.2/deploy/static/provider/cloud/deploy.yaml
$ kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.16.0/cert-manager.yaml
$ kubectl create secret docker-registry oracle-docker-registry \
    --docker-server=$(DOCKER_SERVER) \
    --docker-username=$(DOCKER_USERNAME) \
    --docker-password=$(DOCKER_PASSWORD) \
    --docker-email=$(DOCKER_EMAIL)
