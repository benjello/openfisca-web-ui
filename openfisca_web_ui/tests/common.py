# -*- coding: utf-8 -*-


import os
import unittest

from paste.deploy import loadapp

from .. import conf, environment


app = None


class TestCaseWithApp(unittest.TestCase):
    def setUp(self):  # noqa
        global app
        if app is None:
            conf_file_path = os.path.abspath(os.environ.get(u'PASTE_INI', u'test.ini'))
            app = loadapp(u'config:{}#main'.format(conf_file_path))
            environment.setup_environment()
        environment.db.connection.drop_database(conf['database.name'])
