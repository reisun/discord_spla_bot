FROM amazonlinux:2

RUN yum -y --setopt=tsflags=nodocs update && \
    yum -y install tar && \
    yum -y install zip && \
    yum -y install unzip && \
    yum -y install gzip && \
    touch ~/.bashrc && \
    echo "alias ll='ls -al'" >> ~/.bashrc && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash && \
    . ~/.nvm/nvm.sh && \
    nvm install 16 && \
    echo "export PATH=$PATH:/home/SPLABOT/node_modules/.bin" >> ~/.bashrc && \
    source ~/.bashrc && \
    yum clean all