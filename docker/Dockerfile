FROM ubuntu:trusty
MAINTAINER Sébastien M-B <essembeh@gmail.com>

RUN locale-gen en_US.UTF-8  
ENV LANG en_US.UTF-8  
ENV LANGUAGE en_US:en  
ENV LC_ALL en_US.UTF-8

ADD sources.list /etc/apt/

RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y curl

RUN curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -
RUN apt install -y nodejs
RUN apt-get install -y nodejs

RUN sudo apt-get install -y software-properties-common
RUN sudo apt-add-repository ppa:brightbox/ruby-ng
RUN sudo apt-get update
RUN sudo apt-get install -y ruby2.4-dev

RUN apt-get install -y ruby-compass

RUN sudo gem install compass

RUN npm install -g gulp-cli
RUN npm config set registry http://registry.npmjs.org/
RUN mkdir "${HOME}/.npm-global"
RUN npm config set prefix "${HOME}/.npm-global"
ENV PATH="/root/.npm-global/bin:$PATH"

RUN npm install -g grunt-cli bower

RUN git clone https://github.com/TheTechWalrus/depthy.git && echo "ab"
WORKDIR /depthy
RUN npm install
RUN bower install --allow-root --config.interactive=false

RUN echo $(npm ls gulp) && echo "ff"
EXPOSE 9000 
ENTRYPOINT grunt serve