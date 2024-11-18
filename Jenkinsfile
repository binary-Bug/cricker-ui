pipeline {
    agent any
    stages {
        stage('Verify node version') {
            steps {
                sh 'node --version'
            }
        }
        stage('Verify npm version') {
            steps {
                sh 'npm --version'
            }
        }
        stage('Install Packages') {
            steps {
                sh 'npm i'
            }
        }
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        stage('Clear Workspace') {
            steps {
                script{
                    pwd = pwd()
                }
                echo "CLEARING $pwd"
                sh 'rm -r *'
                echo "$pwd CLEANED"
                dir('../') {
                    script{
                    pwd = pwd()
                     echo "CLEARING $pwd"
                    sh 'rm -r *'
                    echo "$pwd CLEANED"
                    }   
                }
            }
        }
        stage('Return Job Status to Github') {
            steps {
                sh 'echo Completed'
            }
        }
    }
}